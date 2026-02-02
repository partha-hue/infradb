import json
import os
import sqlite3
import cohere
import csv
import io
import time
import re
import platform
import logging
import pandas as pd
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponse
from dotenv import load_dotenv
import psycopg2
import mysql.connector
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, parser_classes, authentication_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import DatabaseConnection, QueryHistory, SavedQuery, AuditLog, UserProfile
from .db_manager import DBManager
from .excel_handler import sanitize_column_name, infer_sql_type, generate_create_table_sql, generate_insert_sql
from .schema_engine import SchemaEngine
from .ai_advisor import AIAdvisor

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

cohere_api_key = os.getenv("COHERE_API_KEY")
co = None
if cohere_api_key:
    try:
        co = cohere.Client(cohere_api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Cohere client: {e}")

# Connection pool
user_db_managers = {}

def get_user_manager(user_id):
    if user_id not in user_db_managers:
        user_db_managers[user_id] = DBManager()
    return user_db_managers[user_id]

def _split_sql_statements(query):
    statements = []
    current = []
    in_single_quote = False
    in_double_quote = False
    escaped = False
    for char in query:
        if escaped:
            current.append(char); escaped = False; continue
        if char == "\\":
            escaped = True; current.append(char); continue
        if char == "'" and not in_double_quote: in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote: in_double_quote = not in_double_quote
        if char == ';' and not in_single_quote and not in_double_quote:
            stmt = "".join(current).strip()
            if stmt: statements.append(stmt)
            current = []
        else: current.append(char)
    last = "".join(current).strip()
    if last: statements.append(last)
    return statements

def _analyze_query_safety(stmt, config, user_profile):
    is_prod = config.get('is_production', False)
    role = user_profile.role if user_profile else 'DEVELOPER'
    q = stmt.lower().strip()
    destructive = ["delete", "update", "drop", "truncate"]
    if role == 'READ_ONLY':
        if any(cmd in q for cmd in ["insert", "update", "delete", "drop", "truncate", "create", "alter"]):
            return False, "BLOCKED: Your account has Read-Only permissions."
    if any(cmd in q for cmd in destructive):
        if "where" not in q and is_prod:
            return False, f"BLOCKED: Destructive command '{stmt.split()[0].upper()}' without WHERE clause is prohibited in Production."
    return True, ""

# -------------------------
# AUTH & PROFILE
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username, password = request.data.get("username"), request.data.get("password")
    user = authenticate(username=username, password=password)
    if user:
        profile, _ = UserProfile.objects.get_or_create(user=user)
        refresh = RefreshToken.for_user(user)
        return Response({
            "token": str(refresh.access_token),
            "access": str(refresh.access_token),
            "user": {"username": user.username, "role": profile.role}
        })
    return Response({"error": "Invalid credentials"}, status=401)

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username, password = request.data.get("username"), request.data.get("password")
    if not username or not password: return Response({"error": "Username and password required"}, status=400)
    try:
        if User.objects.filter(username=username).exists(): return Response({"error": "User already exists"}, status=400)
        user = User.objects.create_user(username=username, password=password)
        UserProfile.objects.get_or_create(user=user)
        return Response({"message": "User created successfully"}, status=201)
    except Exception as e: return Response({"error": str(e)}, status=400)

# -------------------------
# DATABASE OPS
# -------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect(request):
    user_id = request.user.id
    manager = get_user_manager(user_id)
    conn_id = request.data.get('connection_id')
    
    if conn_id:
        try:
            conn_obj = DatabaseConnection.objects.get(id=conn_id, user=request.user)
            config = {
                "engine": conn_obj.engine, 
                "host": conn_obj.host, 
                "port": conn_obj.port, 
                "username": conn_obj.username, 
                "password": conn_obj.password, 
                "database": conn_obj.database, 
                "use_ssl": conn_obj.use_ssl, 
                "is_production": conn_obj.is_production
            }
            manager.active_connection_id = conn_obj.id
        except DatabaseConnection.DoesNotExist: return Response({"error": "Connection not found"}, status=404)
    else:
        config = request.data.copy()
        if 'db_type' in config: config['engine'] = config.get('db_type')
        if 'user' in config and 'username' not in config: config['username'] = config.get('user')
        if 'db_name' in config and 'database' not in config: config['database'] = config.get('db_name')
        manager.active_connection_id = None
        
    try:
        manager.connect(config)
        AuditLog.objects.create(user=request.user, action="CONNECT", details={"engine": config.get('engine'), "database": config.get('database')})
        return Response({'success': True, "is_production": config.get('is_production', False)})
    except Exception as e: return Response({'error': str(e)}, status=400)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def disconnect(request):
    manager = get_user_manager(request.user.id)
    manager.disconnect()
    return Response({"ok": True})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_query(request):
    query = request.data.get("query")
    manager = get_user_manager(request.user.id)
    if not manager.conn and manager.db_type != "mongodb": return Response({"error": "No active database connection."}, status=400)
    config = manager.config or {}
    user_profile, _ = UserProfile.objects.get_or_create(user=request.user)
    statements = _split_sql_statements(query)
    all_results = []
    conn_obj = None
    if hasattr(manager, 'active_connection_id') and manager.active_connection_id:
        try: conn_obj = DatabaseConnection.objects.get(id=manager.active_connection_id)
        except: pass
    for stmt in statements:
        is_safe, error_msg = _analyze_query_safety(stmt, config, user_profile)
        if not is_safe:
            all_results.append({"error": error_msg, "query": stmt[:100], "status": "BLOCKED"})
            continue
        results = manager.execute(stmt)
        for res in results:
            try:
                QueryHistory.objects.create(user=request.user, connection=conn_obj, query=stmt, execution_time=res.get('execution_time', 0.0), row_count=len(res.get('rows', [])), status='FAILED' if 'error' in res else 'SUCCESS', error_message=res.get('error'))
            except: pass
        all_results.extend(results)
    return Response({"results": all_results})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def schema(request):
    manager = get_user_manager(request.user.id)
    if not manager.conn and manager.db_type != 'mongodb': return Response({"error": "No connection"}, status=400)
    result = {"tables": [], "database_name": manager.config.get("database")}
    try:
        cur = manager.cursor
        if manager.db_type == "sqlite":
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'django_%' AND name NOT LIKE 'auth_%';")
            for r in cur.fetchall():
                t = r[0]
                cur.execute(f"PRAGMA table_info(`{t}`);")
                cols = [{"name": col[1], "type": col[2], "pk": col[5] == 1} for col in cur.fetchall()]
                result["tables"].append({"name": t, "columns": cols})
        elif manager.db_type == "postgresql":
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute("""
                    SELECT 
                        column_name, data_type,
                        column_name IN (
                            SELECT kcu.column_name
                            FROM information_schema.table_constraints tc
                            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                            WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = %s
                        ) as is_pk
                    FROM information_schema.columns 
                    WHERE table_name = %s AND table_schema = 'public'
                """, [t, t])
                cols = [{"name": col[0], "type": col[1], "pk": col[2]} for col in cur.fetchall()]
                result["tables"].append({"name": t, "columns": cols})
        elif manager.db_type == "mysql":
            cur.execute("SHOW TABLES")
            tables = [list(r.values())[0] if isinstance(r, dict) else r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute(f"DESCRIBE `{t}`")
                cols = []
                for col in cur.fetchall():
                    name = col['Field'] if isinstance(col, dict) else col[0]
                    type_ = col['Type'] if isinstance(col, dict) else col[1]
                    key = col['Key'] if isinstance(col, dict) else col[3]
                    cols.append({"name": name, "type": type_, "pk": key == 'PRI'})
                result["tables"].append({"name": t, "columns": cols})
        elif manager.db_type == "mongodb":
            db = manager.conn[manager.config.get("database")]
            for coll in db.list_collection_names(): result["tables"].append({"name": coll, "columns": []})
        return Response(result)
    except Exception as e: return Response({"error": str(e)}, status=400)

# -------------------------
# HISTORY & SAVED QUERIES
# -------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def query_history(request):
    history = QueryHistory.objects.filter(user=request.user).order_by('-created_at')[:50]
    data = [{
        "id": str(h.id),
        "query": h.query,
        "execution_time": h.execution_time,
        "row_count": h.row_count,
        "status": h.status,
        "created_at": h.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for h in history]
    return Response(data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_query(request):
    SavedQuery.objects.create(user=request.user, title=request.data.get("title", "Saved"), query=request.data.get("query"))
    return Response({"message": "Saved"})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_saved_queries(request):
    queries = SavedQuery.objects.filter(user=request.user)
    return Response([{"id": str(q.id), "title": q.title, "query": q.query} for q in queries])

# -------------------------
# UTILS & STUBS
# -------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def explain_query(request):
    query = request.data.get("query")
    manager = get_user_manager(request.user.id)
    if not manager.conn: return Response({"error": "No connection"}, status=400)
    try:
        sql = f"EXPLAIN {query}"
        if manager.db_type == 'sqlite': sql = f"EXPLAIN QUERY PLAN {query}"
        return Response({"plan": manager.execute(sql)})
    except Exception as e: return Response({"error": str(e)}, status=400)

@api_view(["POST"])
def recommend_indexes(request): return Response({"recommendations": []})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_info(request): return Response({"environment": "Development", "platform": platform.system()})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_connections(request):
    if request.method == 'GET':
        conns = DatabaseConnection.objects.filter(user=request.user)
        return Response([{"id": str(c.id), "name": c.name, "engine": c.engine} for c in conns])
    return Response({"message": "Saved"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def import_file(request):
    file_obj = request.FILES.get('file')
    table_name = request.data.get('table_name')
    if not file_obj or not table_name:
        return Response({"error": "File and table name are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    manager = get_user_manager(request.user.id)
    if not manager.conn:
        return Response({"error": "No active database connection"}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Read file into DataFrame
        filename = file_obj.name.lower()
        if filename.endswith('.csv'):
            df = pd.read_csv(file_obj)
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(file_obj)
        elif filename.endswith('.json'):
            df = pd.read_json(file_obj)
        else:
            return Response({"error": "Unsupported file format"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Sanitize table name
        table_name = re.sub(r'[^a-zA-Z0-9_]', '_', table_name)
        
        # Generate and execute CREATE TABLE
        create_sql = generate_create_table_sql(df, table_name)
        manager.execute(create_sql)
        
        # Generate and execute INSERT
        insert_sql, values = generate_insert_sql(df, table_name)
        manager.execute_values(insert_sql, values)
        
        return Response({
            "message": f"Successfully imported {len(df)} rows into {table_name}",
            "table_name": table_name,
            "row_count": len(df)
        })
    except Exception as e:
        logger.error(f"Import error: {str(e)}")
        return Response({"error": f"Import failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
def export_data(request): return Response({"ok": True})
@api_view(["POST"])
def import_csv(request): return Response({"ok": True})
@api_view(["POST"])
def import_excel(request): return Response({"ok": True})
@api_view(["POST"])
def create_database(request): return Response({"ok": True})
@api_view(["GET"])
def list_databases(request): return Response({"databases": []})
@api_view(["GET"])
def er_diagram(request): return Response({})
@api_view(["GET"])
def ping(request): return Response({"status": "ok"})
@api_view(["POST"])
def transaction_control(request): return Response({"ok": True})
@api_view(["POST"])
def load_sample_db(request): return Response({"ok": True})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_query_suggest(request):
    prompt = request.data.get("prompt", "").strip()
    current_sql = request.data.get("current_sql", "")
    action = request.data.get("action", "generate")
    
    if not co: return Response({"error": "AI Agent not initialized"}, status=503)
    
    manager = get_user_manager(request.user.id)
    schema_context = ""
    if manager.conn or manager.db_type == "mongodb":
        advisor = AIAdvisor(manager, co)
        schema_context = advisor._get_schema_summary()

    if action == "analyze" or prompt.lower() in ["schema analysis", "analyze schema", "optimize database"]:
        if not manager.conn: return Response({"error": "No active connection for analysis"}, status=400)
        advisor = AIAdvisor(manager, co)
        report = advisor.analyze_and_suggest()
        return Response({"report": report, "is_report": True})

    context_prompt = f"""
    You are InfraDB AI, a principal DBMS architect.
    
    CURRENT DATABASE SCHEMA:
    {schema_context}
    
    CURRENT EDITOR SQL:
    {current_sql}
    
    USER REQUEST: {prompt}
    ACTION TYPE: {action}
    
    INSTRUCTIONS:
    - If action is 'fix', focus on fixing the editor SQL.
    - If action is 'explain', explain the editor SQL in detail.
    - If the user asks about tables or columns, refer to the schema provided above.
    - Always provide SQL in code blocks like ```sql ... ```.
    - Be concise and technical.
    """

    try:
        res = co.chat(message=context_prompt)
        sql_match = re.search(r'```sql\n(.*?)\n```', res.text, re.DOTALL)
        sql_extracted = sql_match.group(1) if sql_match else ""
        return Response({"text": res.text, "sql": sql_extracted})
    except Exception as e: return Response({"error": str(e)}, status=500)

# -------------------------
# SCHEMA SYNC OPS
# -------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sql_to_designer(request):
    sql = request.data.get('sql', '')
    manager = get_user_manager(request.user.id)
    dialect = manager.db_type or "postgres"
    engine = SchemaEngine(dialect=dialect)
    result = engine.sql_to_json(sql)
    return Response(result)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def designer_to_sql(request):
    schema_json = request.data.get('schema', {})
    manager = get_user_manager(request.user.id)
    dialect = manager.db_type or "postgres"
    engine = SchemaEngine(dialect=dialect)
    sql = engine.json_to_sql(schema_json)
    return Response({"sql": sql})

# -------------------------
# AI ADVISOR
# -------------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_analyze_schema(request):
    manager = get_user_manager(request.user.id)
    if not manager.conn: return Response({"error": "No connection"}, status=400)
    advisor = AIAdvisor(manager, co)
    result = advisor.analyze_and_suggest()
    return Response(result)
