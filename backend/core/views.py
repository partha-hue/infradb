# backend/core/views.py
import json
import os
import sqlite3
import cohere
import csv
import io
import time
import re
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from dotenv import load_dotenv
import psycopg2
import mysql.connector
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

# Load environment variables
load_dotenv()

cohere_api_key = os.getenv("COHERE_API_KEY")
if not cohere_api_key:
    print("🚨 Missing COHERE_API_KEY in .env file")
    co = None
else:
    co = cohere.Client(cohere_api_key)

# Try to import QueryHistory model
try:
    from .models import QueryHistory, SavedQuery
    _HAVE_QUERY_HISTORY_MODEL = True
except Exception:
    QueryHistory = None
    SavedQuery = None
    _HAVE_QUERY_HISTORY_MODEL = False

# Global connection store
connections = {}
in_memory_history = []
saved_queries_memory = []

# Helper: create DB cursor
def _get_cursor_and_commit_fn(conn_obj, db_type):
    if db_type == "sqlite":
        cur = conn_obj.cursor()
        return cur, lambda: conn_obj.commit()
    elif db_type == "mysql":
        cur = conn_obj.cursor(buffered=True)
        return cur, lambda: conn_obj.commit()
    elif db_type == "postgresql":
        cur = conn_obj.cursor()
        return cur, lambda: conn_obj.commit()
    else:
        raise ValueError("Unsupported db type")

# -------------------------
# AUTHENTICATION ENDPOINTS
# -------------------------

@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    
    if not username or not password:
        return Response({"error": "Username and password required"}, status=400)
    
    user = authenticate(username=username, password=password)
    
    if user is not None:
        refresh = RefreshToken.for_user(user)
        role = "admin" if user.is_superuser or user.is_staff else "user"
        
        return Response({
            "token": str(refresh.access_token),
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "username": user.username,
                "email": user.email,
                "role": role,
                "id": user.id
            }
        }, status=200)
    else:
        return Response({"error": "Invalid credentials"}, status=401)

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email", "")
    
    if not username or not password:
        return Response({"error": "Username and password required"}, status=400)
    
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=400)
    
    try:
        user = User.objects.create_user(username=username, password=password, email=email)
        return Response({"message": "User created successfully"}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

@api_view(["GET"])
@permission_classes([AllowAny])
def ping(request):
    return Response({"status": "ok"}, status=200)

# -------------------------
# CONNECT / DISCONNECT
# -------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def connect(request):
    db_type = request.data.get('db_type') or request.data.get('type')
    if not db_type:
        return Response({'error': 'Missing required field: db_type'}, status=400)

    if db_type == 'sqlite':
        database = request.data.get('database', 'default.db')
        db_dir = os.path.join(settings.BASE_DIR, 'user_databases')
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, database)

        try:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            connection_id = f"sqlite_{os.path.basename(database)}"
            connections[connection_id] = {"type": "sqlite", "conn": conn, "database": db_path}
            connections["current"] = connections[connection_id]
            return Response({'success': True, 'ok': True, 'message': f'✅ Connected to {database}'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    elif db_type in ['mysql', 'postgresql']:
        host = request.data.get('host')
        port = request.data.get('port')
        user = request.data.get('user')
        password = request.data.get('password')
        database = request.data.get('database')
        try:
            if db_type == 'mysql':
                conn = mysql.connector.connect(host=host, port=int(port or 3306), user=user, password=password, database=database)
            else:
                conn = psycopg2.connect(host=host, port=int(port or 5432), user=user, password=password, dbname=database)
            
            connection_id = f"{db_type}_{host}_{database}"
            connections[connection_id] = {"type": db_type, "conn": conn}
            connections["current"] = connections[connection_id]
            return Response({'success': True, 'ok': True, 'message': f'✅ Connected to {db_type}'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
    return Response({'error': 'Unsupported db_type'}, status=400)

@api_view(["POST"])
@permission_classes([AllowAny])
def disconnect(request):
    if "current" in connections:
        try:
            connections["current"]["conn"].close()
        except: pass
        del connections["current"]
    return Response({"ok": True}, status=200)

# -------------------------
# SCHEMA
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def schema(request):
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    config = connections["current"]
    db_type = config["type"]
    conn = config["conn"]
    result = []
    try:
        cur = conn.cursor()
        if db_type == "postgresql":
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s;", (t,))
                cols = [r[0] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})
        elif db_type == "mysql":
            cur.execute("SHOW TABLES;")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute(f"SHOW COLUMNS FROM `{t}`;")
                cols = [r[0] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})
        elif db_type == "sqlite":
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute(f"PRAGMA table_info(`{t}`);")
                cols = [r[1] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})
        cur.close()
        return Response({"tables": result}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# RUN QUERY
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def run_query(request):
    query = request.data.get("query") or request.data.get("sql")
    if not query: return Response({"error": "No query provided"}, status=400)
    if "current" not in connections: return Response({"error": "No active connection"}, status=400)

    config = connections["current"]
    db_type, conn = config["type"], config["conn"]
    start_time = time.time()
    try:
        cur, commit_fn = _get_cursor_and_commit_fn(conn, db_type)
        results = []
        statements = [s.strip() for s in query.split(';') if s.strip()] or [query.strip()]
        for stmt in statements:
            cur.execute(stmt)
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = [list(r) for r in cur.fetchall()]
                results.append({"columns": columns, "rows": rows, "message": f"✅ {len(rows)} rows"})
            else:
                commit_fn()
                results.append({"columns": [], "rows": [], "message": "✅ Success"})
        execution_time = (time.time() - start_time) * 1000
        if _HAVE_QUERY_HISTORY_MODEL:
            try: QueryHistory.objects.create(query=query, execution_time=execution_time)
            except: pass
        else:
            in_memory_history.append({"query": query, "execution_time": execution_time, "created_at": datetime.now().isoformat()})
        cur.close()
        return Response({"results": results, "execution_time": execution_time}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# AI / HISTORY / EXPLAIN
# -------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def ai_query_suggest(request):
    prompt = request.data.get("prompt") or request.data.get("query")
    if not (prompt and co): return Response({"error": "Missing prompt or AI not configured"}, status=400)
    try:
        response = co.chat(model="command-r-plus", message=f"Generate SQL for: {prompt}")
        sql = response.text.strip().replace('```sql', '').replace('```', '')
        return Response({"sql": sql})
    except Exception as e: return Response({"error": str(e)}, status=500)

@api_view(["GET"])
@permission_classes([AllowAny])
def query_history(request):
    if _HAVE_QUERY_HISTORY_MODEL:
        qs = QueryHistory.objects.all().order_by("-created_at")[:50]
        return Response([{"query": q.query, "execution_time": getattr(q, 'execution_time', 0), "created_at": q.created_at} for q in qs])
    return Response(in_memory_history[::-1])

@api_view(["POST"])
@permission_classes([AllowAny])
def explain_query(request):
    query = request.data.get("query") or request.data.get("sql")
    if not (query and "current" in connections): return Response({"error": "Missing query/connection"}, status=400)
    db_type, conn = connections["current"]["type"], connections["current"]["conn"]
    try:
        cur = conn.cursor()
        prefix = "EXPLAIN ANALYZE " if db_type == "postgresql" else ("EXPLAIN QUERY PLAN " if db_type == "sqlite" else "EXPLAIN ")
        cur.execute(f"{prefix}{query}")
        plan = [str(r) for r in cur.fetchall()]
        cur.close()
        return Response({"plan": plan})
    except Exception as e: return Response({"error": str(e)}, status=400)

# -------------------------
# MANAGEMENT
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def create_database(request):
    name = request.data.get("name")
    if not (name and "current" in connections): return Response({"error": "Name/Connection required"}, status=400)
    db_type, conn = connections["current"]["type"], connections["current"]["conn"]
    try:
        cur = conn.cursor()
        if db_type == "mysql": cur.execute(f"CREATE DATABASE IF NOT EXISTS `{name}`")
        elif db_type == "postgresql": 
            conn.autocommit = True
            cur.execute(f"CREATE DATABASE {name}")
            conn.autocommit = False
        else: return Response({"error": "Not supported for SQLite"}, status=400)
        cur.close()
        return Response({"message": "Database created"})
    except Exception as e: return Response({"error": str(e)}, status=400)

@api_view(["GET"])
@permission_classes([AllowAny])
def list_databases(request):
    if "current" not in connections: return Response({"error": "No connection"}, status=400)
    db_type, conn = connections["current"]["type"], connections["current"]["conn"]
    try:
        cur = conn.cursor()
        if db_type == "mysql": cur.execute("SHOW DATABASES")
        elif db_type == "postgresql": cur.execute("SELECT datname FROM pg_database")
        else: return Response({"databases": ["SQLite"]})
        dbs = [r[0] for r in cur.fetchall()]
        cur.close()
        return Response({"databases": dbs})
    except Exception as e: return Response({"error": str(e)}, status=400)

# -------------------------
# IMPORT / OTHER
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def import_csv(request):
    if "current" not in connections: return Response({"error": "No connection"}, status=400)
    f = request.FILES.get("file")
    if not f: return Response({"error": "No file"}, status=400)
    db_type, conn = connections["current"]["type"], connections["current"]["conn"]
    try:
        table_name = "imported_" + os.path.splitext(f.name)[0]
        content = f.read().decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        rows = list(reader)
        cur = conn.cursor()
        cols_def = ", ".join([f"`{h}` TEXT" for h in headers])
        cur.execute(f"CREATE TABLE IF NOT EXISTS `{table_name}` ({cols_def})")
        placeholder = ", ".join(["?"] * len(headers)) if db_type == "sqlite" else ", ".join(["%s"] * len(headers))
        cur.executemany(f"INSERT INTO `{table_name}` VALUES ({placeholder})", rows)
        conn.commit()
        cur.close()
        return Response({"message": f"Imported {len(rows)} rows into {table_name}"})
    except Exception as e: return Response({"error": str(e)}, status=400)

@api_view(["POST"])
@permission_classes([AllowAny])
def import_excel(request):
    return Response({"error": "Excel import requires additional dependencies"}, status=501)

@api_view(["GET"])
@permission_classes([AllowAny])
def er_diagram(request):
    return Response({"tables": {}})

@api_view(["POST"])
@permission_classes([AllowAny])
def load_sample_db(request):
    try:
        path = os.path.join(settings.BASE_DIR, "sample_db.sqlite3")
        conn = sqlite3.connect(path, check_same_thread=False)
        cur = conn.cursor()
        cur.executescript("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT); INSERT OR IGNORE INTO users (name) VALUES ('Alice'), ('Bob');")
        conn.commit()
        connections["current"] = {"type": "sqlite", "conn": conn}
        return Response({"ok": True})
    except Exception as e: return Response({"error": str(e)}, status=400)

@api_view(["POST"])
@permission_classes([AllowAny])
def recommend_indexes(request):
    return Response({"recommendations": []})

@api_view(["POST"])
@permission_classes([AllowAny])
def save_query(request):
    t, q = request.data.get("title"), request.data.get("query")
    if not (t and q): return Response({"error": "Missing data"}, status=400)
    if _HAVE_QUERY_HISTORY_MODEL: SavedQuery.objects.create(title=t, query=q)
    else: saved_queries_memory.append({"title": t, "query": q})
    return Response({"message": "Saved"})

@api_view(["GET"])
@permission_classes([AllowAny])
def get_saved_queries(request):
    if _HAVE_QUERY_HISTORY_MODEL: return Response([{"title": q.title, "query": q.query} for q in SavedQuery.objects.all()])
    return Response(saved_queries_memory)
