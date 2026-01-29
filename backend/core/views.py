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
    # Do not raise error here to allow other features to work without AI
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
            "access": str(refresh.access_token), # Added for compatibility
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
# CONNECT
# -------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def connect(request):
    db_type = request.data.get('db_type') or request.data.get('type')
    if not db_type:
        return Response({'error': 'Missing required field: db_type'}, status=400)

    print(f"[CONNECT] Requested database type: {db_type}")

    if db_type == 'sqlite':
        database = request.data.get('database', 'default.db')
        db_dir = os.path.join(settings.BASE_DIR, 'user_databases')
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, database)

        try:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.execute("SELECT 1")
            connection_id = f"sqlite_{os.path.basename(database)}"
            connections[connection_id] = {"type": "sqlite", "conn": conn, "database": db_path}
            connections["current"] = connections[connection_id]
            print(f"[CONNECT] Active: {connection_id}")

            return Response({
                'success': True,
                'ok': True,
                'message': f'✅ Connected to SQLite: {database}',
                'connection_id': connection_id
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    elif db_type in ['mysql', 'postgresql']:
        host = request.data.get('host')
        port = request.data.get('port')
        user = request.data.get('user')
        password = request.data.get('password')
        database = request.data.get('database')

        if not all([host, user, password, database]):
            return Response({'error': 'Missing connection parameters'}, status=400)

        try:
            if db_type == 'mysql':
                conn = mysql.connector.connect(
                    host=host, port=int(port or 3306), user=user, password=password, database=database
                )
            else:
                conn = psycopg2.connect(
                    host=host, port=int(port or 5432), user=user, password=password, dbname=database
                )
            
            connection_id = f"{db_type}_{host}_{database}"
            connections[connection_id] = {
                "type": db_type, "conn": conn, 
                "host": host, "port": port, "user": user, "password": password, "database": database
            }
            connections["current"] = connections[connection_id]
            return Response({'success': True, 'ok': True, 'message': f'✅ Connected to {db_type}'})
        except Exception as e:
            return Response({'error': str(e)}, status=400)

    return Response({'error': 'Unsupported db_type'}, status=400)

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
    if not query:
        return Response({"error": "No query provided"}, status=400)

    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    config = connections["current"]
    db_type = config["type"]
    conn = config["conn"]
    
    start_time = time.time()
    try:
        cur, commit_fn = _get_cursor_and_commit_fn(conn, db_type)
        results = []
        
        # Split by semicolon but keep basic support
        statements = [s.strip() for s in query.split(';') if s.strip()]
        if not statements: statements = [query.strip()]

        for stmt in statements:
            cur.execute(stmt)
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = [list(r) for r in cur.fetchall()]
                results.append({
                    "columns": columns,
                    "rows": rows,
                    "message": f"✅ {len(rows)} rows returned"
                })
            else:
                commit_fn()
                results.append({"columns": [], "rows": [], "message": "✅ Success"})

        execution_time = (time.time() - start_time) * 1000
        
        # Save to history
        if _HAVE_QUERY_HISTORY_MODEL:
            try:
                QueryHistory.objects.create(query=query, execution_time=execution_time)
            except: pass
        else:
            in_memory_history.append({"query": query, "execution_time": execution_time, "created_at": datetime.now().isoformat()})

        cur.close()
        return Response({"results": results, "execution_time": execution_time}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# AI SUGGEST
# -------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def ai_query_suggest(request):
    prompt = request.data.get("prompt") or request.data.get("query")
    if not prompt:
        return Response({"error": "Missing prompt"}, status=400)

    if not co:
        return Response({"error": "AI Service not configured"}, status=500)

    try:
        response = co.chat(model="command-r-plus", message=f"Generate only the SQL query for: {prompt}")
        sql = response.text.strip().replace('```sql', '').replace('```', '')
        return Response({"sql": sql})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# -------------------------
# HISTORY
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def query_history(request):
    if _HAVE_QUERY_HISTORY_MODEL:
        qs = QueryHistory.objects.all().order_by("-created_at")[:50]
        return Response([{"query": q.query, "execution_time": getattr(q, 'execution_time', 0), "created_at": q.created_at} for q in qs])
    return Response(in_memory_history[::-1])

# -------------------------
# EXPLAIN
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def explain_query(request):
    query = request.data.get("query") or request.data.get("sql")
    if not query or "current" not in connections:
        return Response({"error": "Missing query or connection"}, status=400)

    config = connections["current"]
    db_type = config["type"]
    conn = config["conn"]

    try:
        cur = conn.cursor()
        prefix = "EXPLAIN ANALYZE " if db_type == "postgresql" else "EXPLAIN "
        if db_type == "sqlite": prefix = "EXPLAIN QUERY PLAN "
        
        cur.execute(f"{prefix}{query}")
        plan = [str(r) for r in cur.fetchall()]
        cur.close()
        return Response({"plan": plan})
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# LOAD SAMPLE DB
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def load_sample_db(request):
    try:
        path = os.path.join(settings.BASE_DIR, "sample_db.sqlite3")
        conn = sqlite3.connect(path, check_same_thread=False)
        cur = conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
            INSERT OR IGNORE INTO users (name, email) VALUES ('Alice', 'alice@example.com'), ('Bob', 'bob@example.com');
        """)
        conn.commit()
        connections["current"] = {"type": "sqlite", "conn": conn, "database": path}
        return Response({"ok": True, "message": "Sample DB loaded"})
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# SAVE QUERY
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def save_query(request):
    title = request.data.get("title")
    query = request.data.get("query")
    if not title or not query:
        return Response({"error": "Title and query required"}, status=400)
    
    if _HAVE_QUERY_HISTORY_MODEL:
        SavedQuery.objects.create(title=title, query=query)
        return Response({"message": "Saved"})
    
    saved_queries_memory.append({"title": title, "query": query})
    return Response({"message": "Saved (memory)"})

@api_view(["GET"])
@permission_classes([AllowAny])
def get_saved_queries(request):
    if _HAVE_QUERY_HISTORY_MODEL:
        return Response([{"title": q.title, "query": q.query} for q in SavedQuery.objects.all()])
    return Response(saved_queries_memory)
