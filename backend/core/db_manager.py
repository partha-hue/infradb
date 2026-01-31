import psycopg2
import mysql.connector
from mysql.connector import errorcode
import sqlite3
import time
import inspect

try:
    from pymongo import MongoClient
    HAS_PYMONGO = True
except ImportError:
    HAS_PYMONGO = False

class DBManager:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.db_type = None
        self.config = None
        self.auto_commit = True
        self.active_connection_id = None

    def _to_int(self, val, default):
        try:
            if val is None or str(val).strip() == "":
                return default
            return int(val)
        except (ValueError, TypeError):
            return default

    def connect(self, config):
        self.db_type = config.get("engine")
        self.config = config
        self.auto_commit = config.get("auto_commit", True)

        try:
            if self.db_type == "postgresql":
                port = self._to_int(config.get("port"), 5432)
                self.conn = psycopg2.connect(
                    host=config.get("host"),
                    port=port,
                    user=config.get("username"),
                    password=config.get("password"),
                    database=config.get("database"),
                    sslmode='require' if config.get("use_ssl") else 'prefer'
                )
                self.conn.autocommit = self.auto_commit
                self.cursor = self.conn.cursor()

            elif self.db_type == "mysql":
                host = config.get("host", "localhost")
                port = self._to_int(config.get("port"), 3306)
                
                # Base parameters that are universal
                params = {
                    'user': config.get("username"),
                    'password': config.get("password"),
                    'database': config.get("database"),
                    'port': port,
                    'autocommit': self.auto_commit,
                }

                # Secure flags (added only if supported by the library version)
                extra_flags = {
                    'get_mysql_rsa_public_key': True,
                    'allow_local_infile': True,
                    'ssl_disabled': not config.get("use_ssl", False)
                }

                # Filter flags based on what the installed connector supports
                try:
                    supported_args = inspect.signature(mysql.connector.connect).parameters
                    for key, value in extra_flags.items():
                        if key in supported_args:
                            params[key] = value
                except:
                    pass

                # ATTEMPT 1: Connect with provided host (e.g. "localhost")
                try:
                    params['host'] = host
                    self.conn = mysql.connector.connect(**params)
                except Exception as e:
                    # ATTEMPT 2: DNS Fallback (localhost -> 127.0.0.1)
                    # Common fix for Windows connection issues
                    if host.lower() == "localhost":
                        params['host'] = "127.0.0.1"
                        try:
                            self.conn = mysql.connector.connect(**params)
                        except:
                            raise e # Raise original error if fallback also fails
                    else:
                        raise e

                self.cursor = self.conn.cursor(dictionary=True)

            elif self.db_type == "sqlite":
                self.conn = sqlite3.connect(config.get("database"), check_same_thread=False)
                self.conn.row_factory = sqlite3.Row
                self.cursor = self.conn.cursor()

            elif self.db_type == "mongodb":
                if not HAS_PYMONGO: raise Exception("Pymongo not installed")
                port = self._to_int(config.get("port"), 27017)
                self.conn = MongoClient(host=config.get("host"), port=port, username=config.get("username"), password=config.get("password"), authSource='admin')
                self.cursor = None 
            else:
                raise Exception(f"Unsupported engine: {self.db_type}")

        except Exception as e:
            # Provide more descriptive error messages for common MySQL issues
            err_str = str(e)
            if "Connection refused" in err_str:
                err_str = "Connection refused: Is MySQL running and accepting remote connections?"
            elif "MySQL Connection not available" in err_str:
                err_str = "MySQL driver error: Try restarting your Python environment or checking MySQL status."
            
            raise Exception(f"Connection failed: {err_str}")

    def execute(self, query):
        if self.db_type == "mongodb": return self._execute_mongodb(query)
        return self._execute_sql(query)

    def _execute_sql(self, query):
        results = []
        statements = [stmt.strip() for stmt in query.split(';') if stmt.strip()]
        for statement in statements:
            start_time = time.time()
            try:
                self.cursor.execute(statement)
                execution_time = (time.time() - start_time) * 1000
                if self.cursor.description:
                    columns = [col[0] for col in self.cursor.description]
                    rows = self.cursor.fetchall()
                    if self.db_type == "sqlite": rows = [list(row) for row in rows]
                    elif self.db_type == "mysql":
                        rows = [list(row.values()) if isinstance(row, dict) else list(row) for row in rows]
                    results.append({'columns': columns, 'rows': rows, 'query': statement, 'execution_time': round(execution_time, 2), 'message': f"✅ {len(rows)} rows"})
                else:
                    if self.auto_commit and self.conn: self.conn.commit()
                    results.append({'columns': [], 'rows': [], 'query': statement, 'execution_time': round(execution_time, 2), 'message': "✅ Success"})
            except Exception as e:
                results.append({'error': str(e), 'query': statement, 'status': 'FAILED'})
        return results

    def execute_values(self, sql, values):
        if not self.conn or (self.db_type != "mongodb" and not self.cursor):
            raise Exception("No active connection")
        
        start_time = time.time()
        try:
            if self.db_type == "sqlite":
                # sqlite3 uses ? instead of %s
                sql = sql.replace('%s', '?')
                self.cursor.executemany(sql, values)
            elif self.db_type == "postgresql" or self.db_type == "mysql":
                self.cursor.executemany(sql, values)
            
            if self.auto_commit and self.conn:
                self.conn.commit()
                
            execution_time = (time.time() - start_time) * 1000
            return {'execution_time': round(execution_time, 2), 'row_count': len(values)}
        except Exception as e:
            if self.conn: self.conn.rollback()
            raise e

    def _execute_mongodb(self, command_str):
        if not HAS_PYMONGO: return [{'error': "Pymongo not installed", 'query': command_str}]
        start_time = time.time()
        try:
            db = self.conn[self.config.get("database")]
            return [{"message": "MongoDB raw execution not implemented", "query": command_str, "execution_time": round((time.time() - start_time) * 1000, 2)}]
        except Exception as e: return [{'error': str(e), 'query': command_str}]

    def set_auto_commit(self, value):
        self.auto_commit = value
        if self.conn and self.db_type in ["postgresql", "mysql"]: self.conn.autocommit = value

    def commit(self):
        if self.conn: self.conn.commit()

    def rollback(self):
        if self.conn: self.conn.rollback()

    def disconnect(self):
        try:
            if self.cursor: self.cursor.close()
            if self.conn: self.conn.close()
        except: pass
