import psycopg2
import mysql.connector

class DBManager:
    def __init__(self):
        self.conn = None
        self.cursor = None

    def connect(self, creds):
        db_type = creds.get("type")

        if db_type == "postgresql":
            self.conn = psycopg2.connect(
                host=creds.get("host", "localhost"),
                port=creds.get("port", "5432"),
                user=creds.get("user", "root"),
                password=creds.get("password", "Partha12"),
                database=creds.get("database", "partha")
            )
        elif db_type == "mysql":
            self.conn = mysql.connector.connect(
                host=creds.get("host", "localhost"),
                port=creds.get("port", "3306"),
                user=creds.get("user", "root"),
                password=creds.get("password", "Partha12"),
                database=creds.get("database", "partha"),
                raw=True  # This enables multi-statement support more reliably
            )
        else:
            raise Exception("Unsupported database type")

        self.cursor = self.conn.cursor()

    def execute(self, query):
        results = []
        # Split multiple statements for proper execution
        statements = [stmt.strip() for stmt in query.split(';') if stmt.strip()]
        
        for statement in statements:
            if not statement:
                continue
                
            self.cursor.execute(statement)
            
            try:
                if self.cursor.description:
                    columns = [col[0] for col in self.cursor.description]
                    rows = self.cursor.fetchall()
                    results.append({
                        'columns': columns,
                        'rows': rows,
                        'query': statement,
                        'message': f"✅ Returned {len(rows)} rows"
                    })
                else:
                    self.conn.commit()
                    results.append({
                        'columns': [],
                        'rows': [],
                        'query': statement,
                        'message': "✅ Query executed successfully (no data returned)"
                    })
            except Exception as e:
                results.append({
                    'error': str(e),
                    'query': statement
                })
                
            # For MySQL, move to next result set if available
            if hasattr(self.cursor, 'nextset'):
                while self.cursor.nextset():
                    pass
                    
        return results

    def disconnect(self):
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
