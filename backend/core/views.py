# backend/core/views.py
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

from .excel_handler import process_excel

# Load environment variables
load_dotenv()

cohere_api_key = os.getenv("COHERE_API_KEY")
if not cohere_api_key:
    raise ValueError("🚨 Missing COHERE_API_KEY in .env file")

co = cohere.Client(cohere_api_key)

# Lazy import of Excel handler
excel_handler = None
def get_excel_handler():
    global excel_handler
    if excel_handler is None:
        try:
            from .excel_handler import process_excel
            excel_handler = process_excel
        except ImportError as e:
            print(f"Excel import functionality not available: {str(e)}")
            return None
    return excel_handler

# Try to import QueryHistory model
try:
    from .models import QueryHistory, SavedQuery
    _HAVE_QUERY_HISTORY_MODEL = True
except Exception:
    QueryHistory = None
    SavedQuery = None
    _HAVE_QUERY_HISTORY_MODEL = False

# In-memory store for connections
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

# Helper: infer column type
def _infer_column_type(values):
    non_empty = [v for v in values if v and str(v).strip()]
    if not non_empty:
        return "TEXT"
    
    try:
        for v in non_empty:
            int(v)
        return "INTEGER"
    except ValueError:
        pass
    
    try:
        for v in non_empty:
            float(v)
        return "REAL"
    except ValueError:
        pass
    
    return "TEXT"

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

# -------------------------
# CONNECT - MULTI-CLOUD SUPPORT
# -------------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def connect(request):
    """Connect to database - supports SQLite, MySQL, PostgreSQL (cloud and local)"""
    
    # Accept both 'type' and 'db_type' for backward compatibility
    db_type = request.data.get('db_type') or request.data.get('type')
    
    if not db_type:
        return Response({'error': 'Missing required field: db_type or type'}, status=400)
    
    print(f"[CONNECT] Database type: {db_type}")
    
    # ========== SQLite ==========
    if db_type == 'sqlite':
        database = request.data.get('database', 'default.db')
        
        db_dir = os.path.join(settings.BASE_DIR, 'user_databases')
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, database)
        
        try:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.execute("SELECT 1")  # Test connection
            
            connections["current"] = {"type": "sqlite", "conn": conn}
            
            return Response({
                'success': True,
                'ok': True,
                'message': f'✅ Connected to SQLite: {database}',
                'provider': 'Local SQLite'
            })
        except Exception as e:
            return Response({'error': f'SQLite error: {str(e)}'}, status=400)
    
    # ========== MySQL ==========
    elif db_type == 'mysql':
        host = request.data.get('host')
        port = request.data.get('port', 3306)
        user = request.data.get('user')
        password = request.data.get('password')
        database = request.data.get('database')
        
        if not all([host, user, password, database]):
            return Response({
                'error': 'MySQL requires: host, user, password, database'
            }, status=400)
        
        # Block localhost in production
        if host in ['localhost', '127.0.0.1', '::1']:
            return Response({
                'error': '⚠️ Localhost not supported in production.\n\n' +
                        'Use cloud MySQL:\n' +
                        '• PlanetScale (free tier)\n' +
                        '• Railway (free $5/month)\n' +
                        '• AWS RDS, Google Cloud SQL'
            }, status=400)
        
        try:
            # Detect cloud provider
            provider = 'Unknown'
            if 'planetscale' in host.lower():
                provider = 'PlanetScale'
            elif 'railway' in host.lower():
                provider = 'Railway'
            elif 'amazonaws' in host.lower():
                provider = 'AWS RDS'
            
            conn = mysql.connector.connect(
                host=host,
                port=int(port),
                user=user,
                password=password,
                database=database,
                autocommit=False
            )
            
            connections["current"] = {
                "type": "mysql",
                "conn": conn,
                "provider": provider
            }
            
            return Response({
                'success': True,
                'ok': True,
                'message': f'✅ Connected to MySQL: {database}',
                'provider': provider
            })
            
        except Exception as e:
            return Response({'error': f'MySQL connection failed: {str(e)}'}, status=400)
    
    # ========== PostgreSQL ==========
    elif db_type == 'postgresql':
        host = request.data.get('host')
        port = request.data.get('port', 5432)
        user = request.data.get('user')
        password = request.data.get('password')
        database = request.data.get('database')
        
        if not all([host, user, password, database]):
            return Response({
                'error': 'PostgreSQL requires: host, user, password, database'
            }, status=400)
        
        # Block localhost in production
        if host in ['localhost', '127.0.0.1', '::1']:
            return Response({
                'error': '⚠️ Localhost not supported in production.\n\n' +
                        'Use cloud PostgreSQL:\n' +
                        '• Render (free tier)\n' +
                        '• Supabase (free tier)\n' +
                        '• Railway, Neon, AWS RDS'
            }, status=400)
        
        try:
            # Detect cloud provider
            provider = 'Unknown'
            if 'render' in host.lower():
                provider = 'Render'
            elif 'supabase' in host.lower():
                provider = 'Supabase'
            elif 'railway' in host.lower():
                provider = 'Railway'
            
            conn = psycopg2.connect(
                host=host,
                port=int(port),
                user=user,
                password=password,
                dbname=database
            )
            
            connections["current"] = {
                "type": "postgresql",
                "conn": conn,
                "provider": provider
            }
            
            return Response({
                'success': True,
                'ok': True,
                'message': f'✅ Connected to PostgreSQL: {database}',
                'provider': provider
            })
            
        except Exception as e:
            return Response({'error': f'PostgreSQL connection failed: {str(e)}'}, status=400)
    
    return Response({'error': f'Unsupported database type: {db_type}'}, status=400)

# [REST OF YOUR CODE CONTINUES HERE - disconnect, schema, run_query, etc.]

# -------------------------
# DISCONNECT
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def disconnect(request):
    if "current" in connections:
        try:
            conn = connections["current"]["conn"]
            conn.close()
        except Exception:
            pass
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

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    cur = None
    result = []

    try:
        if db_type == "mysql":
            cur = conn.cursor(buffered=True)
        else:
            cur = conn.cursor()

        if db_type == "postgresql":
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
            tables = [r[0] for r in cur.fetchall()]

            for t in tables:
                cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s ORDER BY ordinal_position;", (t,))
                cols = [r[0] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})

        elif db_type == "mysql":
            # Get the current database name
            cur.execute("SELECT DATABASE();")
            db_name = cur.fetchone()[0]
            
            # Get tables using information_schema
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = %s 
                ORDER BY table_name;
            """, (db_name,))
            tables = [r[0] for r in cur.fetchall()]

            for t in tables:
                # Get columns using information_schema
                cur.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = %s 
                    AND table_name = %s 
                    ORDER BY ordinal_position;
                """, (db_name, t))
                cols = [r[0] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})

        elif db_type == "sqlite":
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
            tables = [r[0] for r in cur.fetchall()]

            for t in tables:
                cur.execute(f"PRAGMA table_info(`{t}`);")
                cols = [r[1] for r in cur.fetchall()]
                result.append({"name": t, "columns": cols})
        else:
            return Response({"error": "Unsupported database type"}, status=400)

        return Response({"tables": result}, status=200)

    except Exception as e:
        print(f"Schema error: {str(e)}")
        return Response({"error": str(e)}, status=400)

    finally:
        if cur:
            try:
                cur.close()
            except:
                pass

# -------------------------
# RUN QUERY (Enhanced with Performance Tracking)
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def run_query(request):
    payload = request.data or {}
    query = payload.get("query")
    if not query:
        return Response({"error": "No query provided"}, status=400)

    # Track execution time
    start_time = time.time()

    # Optional connection override
    if payload.get("connection"):
        override = payload["connection"]
        try:
            db_type = (override.get("type") or "").lower()
            if db_type == "sqlite":
                conn = sqlite3.connect(override.get("database") or ":memory:", check_same_thread=False)
            elif db_type == "mysql":
                conn = mysql.connector.connect(
                    host=override.get("host", "localhost"),
                    port=int(override.get("port")) if override.get("port") else 3306,
                    user=override.get("user"),
                    password=override.get("password"),
                    database=override.get("database"),
                    autocommit=False
                )
            elif db_type == "postgresql":
                conn = psycopg2.connect(
                    host=override.get("host", "localhost"),
                    port=int(override.get("port")) if override.get("port") else 5432,
                    user=override.get("user"),
                    password=override.get("password"),
                    dbname=override.get("database")
                )
            else:
                return Response({"error": "Unsupported override database type"}, status=400)
            one_shot = True
        except Exception as e:
            return Response({"error": str(e)}, status=400)
    else:
        if "current" not in connections:
            return Response({"error": "No active database connection"}, status=400)
        db_type = connections["current"]["type"]
        conn = connections["current"]["conn"]
        one_shot = False

    query_to_run = query.strip()

    try:
        if db_type == "mysql":
            cur = conn.cursor(buffered=True)
            commit_fn = lambda: conn.commit()
        else:
            cur, commit_fn = _get_cursor_and_commit_fn(conn, db_type)

        results = []
        
        # Handle multiple statements for all database types
        statements = [stmt.strip() for stmt in query_to_run.split(';') if stmt.strip()]
        
        for statement in statements:
            if not statement:
                continue

            cur.execute(statement)
            
            if cur.description:
                columns = [col[0] for col in cur.description]
                rows = cur.fetchall()
                rows_list = [list(r) for r in rows]
                
                results.append({
                    "query": statement,
                    "columns": columns,
                    "rows": rows_list,
                    "message": f"✅ Returned {len(rows_list)} rows"
                })
            else:
                commit_fn()
                results.append({
                    "query": statement,
                    "columns": [],
                    "rows": [],
                    "message": "✅ Query executed successfully (no data returned)"
                })

        # Handle results for each statement
        while True:
            try:
                if cur.description:
                    columns = [col[0] for col in cur.description]
                    rows = cur.fetchall()
                    rows_list = [list(r) for r in rows]

                    print("✅ Query executed successfully")
                    print("✅ Columns:", columns)
                    print("✅ Rows fetched:", len(rows_list))

                    results.append({
                        "query": query_to_run,
                        "columns": columns,
                        "rows": rows_list,
                        "message": f"✅ Returned {len(rows_list)} rows"
                    })
                else:
                    commit_fn()
                    results.append({
                        "query": query_to_run,
                        "columns": [],
                        "rows": [],
                        "message": "✅ Query executed successfully (no data returned)"
                    })
                
                # For MySQL multi-statements, try to get next result
                if db_type == "mysql" and cur.nextset():
                    continue
                break
            except Exception as stmt_error:
                # No more results
                break

        # Calculate execution time
        execution_time = (time.time() - start_time) * 1000  # ms

        # Store query in history
        try:
            if _HAVE_QUERY_HISTORY_MODEL and QueryHistory is not None:
                QueryHistory.objects.create(
                    query=query_to_run,
                    execution_time=execution_time,
                    row_count=len(rows_list) if cur.description else 0
                )
            else:
                in_memory_history.append({
                    "query": query_to_run,
                    "timestamp": datetime.now().isoformat(),
                    "execution_time": execution_time
                })
                if len(in_memory_history) > 50:
                    in_memory_history.pop(0)
        except Exception:
            pass

        cur.close()
        if one_shot:
            conn.close()

        response_data = {
            "results": results,
            "execution_time": execution_time
        }

        # Add explanation if requested
        if payload.get("explain"):
            try:
                explanation = get_query_explanation(query_to_run, db_type, conn)
                response_data["explanation"] = explanation
            except:
                pass

        return Response(response_data, status=200)

    except Exception as e:
        print("❌ SQL Error:", e)
        if one_shot:
            try:
                conn.close()
            except:
                pass
        return Response({"error": str(e)}, status=400)

# -------------------------
# QUERY EXPLANATION (EXPLAIN)
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def explain_query(request):
    """
    Returns query execution plan
    Body: {"query": "SELECT ..."}
    """
    query = request.data.get("query")
    if not query:
        return Response({"error": "No query provided"}, status=400)

    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]

    try:
        explanation = get_query_explanation(query, db_type, conn)
        return Response({"plan": explanation}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

def get_query_explanation(query, db_type, conn):
    """Helper to get EXPLAIN output"""
    cur, _ = _get_cursor_and_commit_fn(conn, db_type)
    
    try:
        if db_type == "postgresql":
            cur.execute(f"EXPLAIN ANALYZE {query}")
            result = cur.fetchall()
            return [row[0] for row in result]
        elif db_type == "mysql":
            cur.execute(f"EXPLAIN {query}")
            columns = [col[0] for col in cur.description]
            rows = cur.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        elif db_type == "sqlite":
            cur.execute(f"EXPLAIN QUERY PLAN {query}")
            result = cur.fetchall()
            return [{"detail": str(row)} for row in result]
        else:
            return {"error": "Unsupported database type"}
    finally:
        cur.close()

# -------------------------
# INDEX RECOMMENDATIONS
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def recommend_indexes(request):
    """
    Analyze query and recommend indexes
    Body: {"query": "SELECT ..."}
    """
    query = request.data.get("query")
    if not query:
        return Response({"error": "No query provided"}, status=400)

    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    try:
        recommendations = analyze_query_for_indexes(query)
        return Response({"recommendations": recommendations}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

def analyze_query_for_indexes(query):
    """
    Parse query and suggest indexes based on WHERE, JOIN, ORDER BY clauses
    """
    recommendations = []
    query_upper = query.upper()
    
    # Extract table and column names from WHERE clauses
    where_pattern = r'WHERE\s+(\w+)\.?(\w+)\s*[=<>]'
    where_matches = re.findall(where_pattern, query_upper)
    
    for match in where_matches:
        table = match[0] if match[0] else "unknown_table"
        column = match[1] if len(match) > 1 else match[0]
        
        recommendations.append({
            "table": table,
            "column": column,
            "reason": f"Column '{column}' used in WHERE clause",
            "sql": f"CREATE INDEX idx_{table}_{column} ON {table}({column});"
        })
    
    # Extract JOIN conditions
    join_pattern = r'JOIN\s+(\w+)\s+ON\s+\w+\.(\w+)\s*=\s*\w+\.(\w+)'
    join_matches = re.findall(join_pattern, query_upper)
    
    for match in join_matches:
        table = match[0]
        column1 = match[1]
        column2 = match[2]
        
        recommendations.append({
            "table": table,
            "column": column1,
            "reason": f"Column '{column1}' used in JOIN condition",
            "sql": f"CREATE INDEX idx_{table}_{column1} ON {table}({column1});"
        })
    
    # Extract ORDER BY columns
    order_pattern = r'ORDER\s+BY\s+(\w+)\.?(\w+)'
    order_matches = re.findall(order_pattern, query_upper)
    
    for match in order_matches:
        table = match[0] if match[0] else "unknown_table"
        column = match[1] if len(match) > 1 else match[0]
        
        recommendations.append({
            "table": table,
            "column": column,
            "reason": f"Column '{column}' used in ORDER BY clause",
            "sql": f"CREATE INDEX idx_{table}_{column} ON {table}({column});"
        })
    
    # Remove duplicates
    unique_recs = []
    seen = set()
    for rec in recommendations:
        key = (rec["table"], rec["column"])
        if key not in seen:
            seen.add(key)
            unique_recs.append(rec)
    
    return unique_recs

# -------------------------
# EXCEL IMPORT
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def import_excel(request):
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    if "file" not in request.FILES:
        return Response({"error": "No file uploaded"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    
    excel_file = request.FILES["file"]
    sheet_name = request.data.get("sheet_name")
    table_name = request.data.get("table_name")
    
    # Save uploaded file temporarily
    temp_path = os.path.join(settings.MEDIA_ROOT, excel_file.name)
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    
    try:
        with open(temp_path, "wb") as f:
            for chunk in excel_file.chunks():
                f.write(chunk)
        
        # Process Excel file
        result = process_excel(temp_path, sheet_name)
        
        if table_name:
            result["table_name"] = table_name
        
        # Execute SQL statements
        cur = conn.cursor()
        
        try:
            # Create table
            cur.execute(result["create_sql"])
            
            # Insert data in chunks
            chunk_size = 1000
            values = result["values"]
            for i in range(0, len(values), chunk_size):
                chunk = values[i:i + chunk_size]
                cur.executemany(result["insert_sql"], chunk)
            
            conn.commit()
            
            response_data = {
                "message": f"Successfully imported {result['row_count']} rows into table {result['table_name']}",
                "table_name": result["table_name"],
                "row_count": result["row_count"],
                "column_count": result["column_count"],
                "create_sql": result["create_sql"]
            }
            
            return Response(response_data, status=200)
            
        except Exception as e:
            conn.rollback()
            raise Exception(f"Database error: {str(e)}")
            
        finally:
            cur.close()
            
    except Exception as e:
        return Response({"error": str(e)}, status=400)
        
    finally:
        # Clean up temporary file
        try:
            os.remove(temp_path)
        except:
            pass

# -------------------------
# EXCEL IMPORT
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def import_excel(request):
    """
    Import data from Excel file into the current database connection.
    Expects a file upload with the key 'file'.
    Optional parameters:
    - sheet_name: Name of the sheet to import
    - table_name: Custom name for the table to create
    """
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    if "file" not in request.FILES:
        return Response({"error": "No file uploaded"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    
    excel_file = request.FILES["file"]
    sheet_name = request.data.get("sheet_name")
    table_name = request.data.get("table_name")
    
    # Save uploaded file temporarily
    temp_path = os.path.join(settings.MEDIA_ROOT, excel_file.name)
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    
    try:
        with open(temp_path, "wb") as f:
            for chunk in excel_file.chunks():
                f.write(chunk)
        
        # Process Excel file
        result = process_excel(temp_path, sheet_name)
        
        if table_name:
            result["table_name"] = table_name
        
        # Execute SQL statements
        cur = None
        try:
            if db_type == "mysql":
                cur = conn.cursor(buffered=True)
            else:
                cur = conn.cursor()
            
            # Create table
            cur.execute(result["create_sql"])
            
            # Insert data in chunks
            chunk_size = 1000
            values = result["values"]
            for i in range(0, len(values), chunk_size):
                chunk = values[i:i + chunk_size]
                cur.executemany(result["insert_sql"], chunk)
            
            conn.commit()
            
            response_data = {
                "message": f"Successfully imported {result['row_count']} rows into table {result['table_name']}",
                "table_name": result["table_name"],
                "row_count": result["row_count"],
                "column_count": result["column_count"],
                "create_sql": result["create_sql"]
            }
            
            return Response(response_data, status=200)
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise Exception(f"Database error: {str(e)}")
            
        finally:
            if cur:
                cur.close()
            
    except Exception as e:
        return Response({"error": str(e)}, status=400)
        
    finally:
        # Clean up temporary file
        try:
            os.remove(temp_path)
        except:
            pass

# -------------------------
# SAVE QUERY
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def save_query(request):
    """
    Save a query for later use
    Body: {"title": "...", "query": "...", "is_public": true/false}
    """
    title = request.data.get("title")
    query = request.data.get("query")
    is_public = request.data.get("is_public", False)
    
    if not title or not query:
        return Response({"error": "Title and query required"}, status=400)
    
    try:
        if _HAVE_QUERY_HISTORY_MODEL and SavedQuery is not None:
            saved = SavedQuery.objects.create(
                title=title,
                query=query,
                is_public=is_public,
                user=request.user if request.user.is_authenticated else None
            )
            return Response({
                "message": "Query saved successfully",
                "id": saved.id
            }, status=201)
        else:
            # In-memory storage
            saved_queries_memory.append({
                "id": len(saved_queries_memory) + 1,
                "title": title,
                "query": query,
                "is_public": is_public,
                "created_at": datetime.now().isoformat()
            })
            return Response({"message": "Query saved successfully"}, status=201)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# GET SAVED QUERIES
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_saved_queries(request):
    """Return all saved queries"""
    try:
        if _HAVE_QUERY_HISTORY_MODEL and SavedQuery is not None:
            queries = SavedQuery.objects.all().order_by("-created_at")
            result = [{
                "id": q.id,
                "title": q.title,
                "query": q.query,
                "is_public": q.is_public,
                "created_at": q.created_at.isoformat()
            } for q in queries]
            return Response(result, status=200)
        else:
            return Response(saved_queries_memory, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# QUERY HISTORY
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def query_history(request):
    if _HAVE_QUERY_HISTORY_MODEL and QueryHistory is not None:
        qs = QueryHistory.objects.all().order_by("-created_at")[:50]
        out = [{
            "query": q.query,
            "created_at": q.created_at.isoformat(),
            "execution_time": getattr(q, 'execution_time', 0)
        } for q in qs]
        return Response(out, status=200)
    else:
        return Response(in_memory_history[::-1], status=200)

# -------------------------
# CREATE DATABASE
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def create_database(request):
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    cur, commit_fn = _get_cursor_and_commit_fn(conn, db_type)

    db_name = request.data.get("name")
    if not db_name:
        return Response({"error": "Database name is required"}, status=400)

    try:
        if db_type == "mysql":
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`;")
        elif db_type == "postgresql":
            conn.autocommit = True
            cur.execute(f"CREATE DATABASE {db_name};")
            conn.autocommit = False
        else:
            return Response({"error": "Database creation supported only for MySQL/PostgreSQL"}, status=400)

        commit_fn()
        return Response({"message": f"✅ Database '{db_name}' created successfully."}, status=200)

    except Exception as e:
        return Response({"error": str(e)}, status=400)

    finally:
        try:
            cur.close()
        except:
            pass

# -------------------------
# LIST DATABASES
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def list_databases(request):
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    cur, _ = _get_cursor_and_commit_fn(conn, db_type)

    try:
        if db_type == "mysql":
            cur.execute("SHOW DATABASES;")
            databases = [r[0] for r in cur.fetchall()]
        elif db_type == "postgresql":
            cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
            databases = [r[0] for r in cur.fetchall()]
        elif db_type == "sqlite":
            databases = ["SQLite uses individual files instead of databases"]
        else:
            return Response({"error": "Unsupported database type"}, status=400)

        return Response({"databases": databases}, status=200)

    except Exception as e:
        return Response({"error": str(e)}, status=400)

    finally:
        try:
            cur.close()
        except:
            pass

# -------------------------
# IMPORT CSV
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def import_csv(request):
    if "current" not in connections:
        return Response({"error": "No active database connection"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response({"error": "No file uploaded"}, status=400)

    table_name = request.data.get("table_name")
    if not table_name:
        table_name = os.path.splitext(uploaded_file.name)[0]
    
    table_name = "".join(c if c.isalnum() or c == "_" else "_" for c in table_name)
    if not table_name or table_name[0].isdigit():
        table_name = "table_" + table_name
    
    try:
        csv_content = uploaded_file.read().decode('utf-8')
        csv_reader = csv.reader(io.StringIO(csv_content))
        
        headers = next(csv_reader)
        
        sanitized_headers = []
        for h in headers:
            sanitized = "".join(c if c.isalnum() or c == "_" else "_" for c in h)
            if not sanitized or sanitized[0].isdigit():
                sanitized = "col_" + sanitized
            sanitized_headers.append(sanitized)
        
        rows = list(csv_reader)
        
        if not rows:
            return Response({"error": "CSV file is empty"}, status=400)
        
        column_types = []
        for i, header in enumerate(sanitized_headers):
            column_values = [row[i] if i < len(row) else "" for row in rows]
            col_type = _infer_column_type(column_values)
            column_types.append(col_type)
        
        cur, commit_fn = _get_cursor_and_commit_fn(conn, db_type)
        
        if db_type == "postgresql":
            type_map = {"INTEGER": "INTEGER", "REAL": "NUMERIC", "TEXT": "TEXT"}
            columns_def = ", ".join([f'"{h}" {type_map[t]}' for h, t in zip(sanitized_headers, column_types)])
            create_stmt = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({columns_def});'
            placeholders = ", ".join(["%s"] * len(sanitized_headers))
            col_list = ", ".join([f'"{h}"' for h in sanitized_headers])
            insert_stmt = f'INSERT INTO "{table_name}" ({col_list}) VALUES ({placeholders});'
        elif db_type == "mysql":
            type_map = {"INTEGER": "INT", "REAL": "DECIMAL(10,2)", "TEXT": "TEXT"}
            columns_def = ", ".join([f"`{h}` {type_map[t]}" for h, t in zip(sanitized_headers, column_types)])
            create_stmt = f"CREATE TABLE IF NOT EXISTS `{table_name}` ({columns_def});"
            placeholders = ", ".join(["%s"] * len(sanitized_headers))
            col_list = ", ".join([f"`{h}`" for h in sanitized_headers])
            insert_stmt = f"INSERT INTO `{table_name}` ({col_list}) VALUES ({placeholders});"
        else:
            type_map = {"INTEGER": "INTEGER", "REAL": "REAL", "TEXT": "TEXT"}
            columns_def = ", ".join([f"`{h}` {type_map[t]}" for h, t in zip(sanitized_headers, column_types)])
            create_stmt = f"CREATE TABLE IF NOT EXISTS `{table_name}` ({columns_def});"
            placeholders = ", ".join(["?"] * len(sanitized_headers))
            col_list = ", ".join([f"`{h}`" for h in sanitized_headers])
            insert_stmt = f"INSERT INTO `{table_name}` ({col_list}) VALUES ({placeholders});"
        
        print(f"✅ Creating table: {create_stmt}")
        cur.execute(create_stmt)
        commit_fn()
        
        cleaned_rows = []
        for row in rows:
            cleaned_row = []
            for i, val in enumerate(row):
                if i >= len(sanitized_headers):
                    break
                if not val or not str(val).strip():
                    cleaned_row.append(None)
                else:
                    col_type = column_types[i]
                    try:
                        if col_type == "INTEGER":
                            cleaned_row.append(int(val))
                        elif col_type == "REAL":
                            cleaned_row.append(float(val))
                        else:
                            cleaned_row.append(str(val).strip())
                    except ValueError:
                        cleaned_row.append(str(val).strip())
            
            while len(cleaned_row) < len(sanitized_headers):
                cleaned_row.append(None)
            
            cleaned_rows.append(cleaned_row)
        
        print(f"✅ Inserting {len(cleaned_rows)} rows...")
        cur.executemany(insert_stmt, cleaned_rows)
        commit_fn()
        
        cur.close()
        
        return Response({
            "message": f"✅ CSV imported successfully into table '{table_name}'",
            "table_name": table_name,
            "rows_imported": len(cleaned_rows),
            "columns": sanitized_headers
        }, status=200)
        
    except Exception as e:
        print(f"❌ CSV Import Error: {e}")
        return Response({"error": str(e)}, status=400)

# -------------------------
# ER DIAGRAM
# -------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def er_diagram(request):
    if "current" not in connections:
        # Attempt to auto-connect to a default local sqlite DB if available
        try:
            default_db = os.path.join(settings.BASE_DIR, "db.sqlite3")
            if os.path.exists(default_db):
                conn = sqlite3.connect(default_db, check_same_thread=False)
                connections["current"] = {"type": "sqlite", "conn": conn}
            else:
                return Response({"error": "No active database connection"}, status=400)
        except Exception as e:
            return Response({"error": f"No active DB connection and auto-connect failed: {str(e)}"}, status=400)

    db_type = connections["current"]["type"]
    conn = connections["current"]["conn"]
    try:
        cur, _ = _get_cursor_and_commit_fn(conn, db_type)
        tables_info = {}

        if db_type == "postgresql":
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
            table_names = [r[0] for r in cur.fetchall()]
        elif db_type == "mysql":
            cur.execute("SHOW TABLES;")
            table_names = [r[0] for r in cur.fetchall()]
        elif db_type == "sqlite":
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            table_names = [r[0] for r in cur.fetchall()]
        else:
            return Response({"error": "Unsupported database type"}, status=400)

        for t in table_names:
            if db_type == "postgresql":
                cur.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position;", (t,)
                )
                cols = [r[0] for r in cur.fetchall()]
            elif db_type == "mysql":
                cur.execute(f"SHOW COLUMNS FROM `{t}`;")
                cols = [r[0] for r in cur.fetchall()]
            else:
                cur.execute(f"PRAGMA table_info(`{t}`);")
                cols = [r[1] for r in cur.fetchall()]
            tables_info[t] = {"columns": cols, "relations": []}

        try:
            cur.close()
        except:
            pass

        return Response({"tables": tables_info}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)


# -------------------------
# Load Sample DB (onboarding)
# -------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def load_sample_db(request):
    """Create a sample sqlite DB file with seeded data and connect to it.
    This helps beginners explore the app without external DB setup.
    """
    try:
        sample_path = os.path.join(settings.BASE_DIR, "sample_db.sqlite3")

        # Create or overwrite the sample DB
        if os.path.exists(sample_path):
            try:
                os.remove(sample_path)
            except Exception:
                pass

        conn = sqlite3.connect(sample_path, check_same_thread=False)
        cur = conn.cursor()

        # Simple sample schema: products, customers, orders, order_items
        cur.executescript("""
        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL
        );

        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT
        );

        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            created_at TEXT,
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        );

        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            product_id INTEGER,
            qty INTEGER,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );
        """)

        # Seed some data
        products = [
            ("Widget A", 9.99),
            ("Widget B", 14.5),
            ("Gadget", 29.99),
        ]
        customers = [("Alice", "alice@example.com"), ("Bob", "bob@example.com")]

        cur.executemany("INSERT INTO products (name, price) VALUES (?, ?);", products)
        cur.executemany("INSERT INTO customers (name, email) VALUES (?, ?);", customers)

        conn.commit()

        # Add sample orders
        cur.execute("INSERT INTO orders (customer_id, created_at) VALUES (?, ?);", (1, datetime.utcnow().isoformat()))
        order_id = cur.lastrowid
        cur.execute("INSERT INTO order_items (order_id, product_id, qty) VALUES (?, ?, ?);", (order_id, 1, 2))
        conn.commit()

        try:
            cur.close()
        except Exception:
            pass

        # Register as current connection
        connections["current"] = {"type": "sqlite", "conn": conn}

        return Response({"ok": True, "path": sample_path}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

# -------------------------
# AI QUERY SUGGEST
# -------------------------
@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny])
def ai_query_suggest(request):
    try:
        data = json.loads(request.body)
        query_text = data.get("query", "")

        if not query_text:
            return JsonResponse({"error": "Missing query"}, status=400)

        response = co.chat(
            model="command-a-03-2025",
            message=f"Generate an SQL query for: {query_text}"
        )

        sql = response.text.strip() or "-- No SQL generated"
        return JsonResponse({"sql": sql})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
