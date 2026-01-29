try:
    from celery import shared_task
except Exception:
    # Fallback: provide a synchronous "shared_task" decorator so the app
    # can run without Celery installed (useful for local development).
    def shared_task(func=None, **opts):
        def _decorate(f):
            def _wrapped(*args, **kwargs):
                return f(*args, **kwargs)
            # Provide a .delay method used by callers to enqueue tasks
            _wrapped.delay = lambda *a, **k: f(*a, **k)
            return _wrapped

        if func is None:
            return _decorate
        else:
            return _decorate(func)


@shared_task
def create_user_database(data):
    """
    Provision a database for the user. Supported local provider: 'sqlite'.
    For cloud providers (mysql/postgresql) this function will check for
    provider-specific API keys in environment variables and return a
    structured response indicating success or required configuration.

    Expected `data` keys:
      - deployment_id (optional): UUID of Deployment model to update
      - db_type: 'sqlite' | 'mysql' | 'postgresql'
      - db_name: desired database name
      - host/port/user/password: optional for cloud providers
      - provider: optional provider hint (e.g., 'railway', 'supabase')
    """
    import os
    import json
    from django.conf import settings
    from .models import Deployment

    deployment_id = data.get("deployment_id")
    db_type = (data.get("db_type") or data.get("type") or "sqlite").lower()
    db_name = data.get("db_name") or data.get("database") or data.get("db_name")
    provider = (data.get("provider") or "").lower()

    # Helper to update deployment model state (best-effort)
    def _update_deployment(status=None, result=None):
        if not deployment_id:
            return
        try:
            dep = Deployment.objects.filter(id=deployment_id).first()
            if not dep:
                return
            if status:
                dep.status = status
            if result is not None:
                try:
                    dep.result = json.dumps(result)
                except Exception:
                    dep.result = str(result)
            dep.save()
        except Exception:
            # Don't raise - tasks should be best-effort updating DB
            pass

    _update_deployment(status="provisioning")

    # LOCAL SQLITE: create a sqlite file under project user_databases
    if db_type == "sqlite":
        try:
            import sqlite3
            user_db_dir = os.path.join(settings.BASE_DIR, "user_databases")
            os.makedirs(user_db_dir, exist_ok=True)
            # ensure extension
            if not db_name.endswith(".sqlite3") and not db_name.endswith(".db"):
                db_file = f"{db_name}.sqlite3"
            else:
                db_file = db_name
            db_path = os.path.join(user_db_dir, db_file)
            # Create empty sqlite file by connecting
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA user_version = 1;")
            conn.commit()
            conn.close()

            result = {
                "ok": True,
                "type": "sqlite",
                "path": db_path,
                "database": db_file,
            }
            _update_deployment(status="ready", result=result)
            return result
        except Exception as e:
            _update_deployment(status="error", result={"error": str(e)})
            return {"ok": False, "error": str(e)}

    # CLOUD PROVIDERS: for now return guidance or attempt simple connect if credentials provided
    if db_type in ("mysql", "postgresql"):
        # If host and credentials provided, attempt a test connection
        host = data.get("host")
        port = data.get("port")
        user = data.get("user") or data.get("user_name") or data.get("username")
        password = data.get("password")
        database = data.get("database") or db_name

        if host and database:
            try:
                if db_type == "mysql":
                    import mysql.connector
                    conn = mysql.connector.connect(
                        host=host,
                        port=int(port) if port else 3306,
                        user=user,
                        password=password,
                        database=database,
                        connection_timeout=10
                    )
                    conn.close()
                else:
                    import psycopg2
                    conn = psycopg2.connect(
                        host=host,
                        port=int(port) if port else 5432,
                        user=user,
                        password=password,
                        dbname=database,
                        connect_timeout=10
                    )
                    conn.close()

                result = {"ok": True, "type": db_type, "host": host, "database": database}
                _update_deployment(status="ready", result=result)
                return result
            except Exception as e:
                msg = f"Connection test failed: {str(e)}"
                _update_deployment(status="error", result={"error": msg})
                return {"ok": False, "error": msg}

        # Provider-based creation requires provider API keys and specific flows
        # Check for provider-specific environment variables (example: RAILWAY_API_KEY)
        if provider == "railway":
            api_key = os.getenv("RAILWAY_API_KEY")
            if not api_key:
                msg = "Railway provisioning requires RAILWAY_API_KEY in environment"
                _update_deployment(status="requires_configuration", result={"error": msg})
                return {"ok": False, "error": msg}
            # TODO: implement Railway API provisioning using api_key
            msg = "Railway provisioning not implemented in this environment"
            _update_deployment(status="requires_configuration", result={"error": msg})
            return {"ok": False, "error": msg}

        # Generic fallback: instruct user to provide host/credentials or configure provider
        msg = "Cloud provisioning requires provider credentials or host/database. Provide host+db or configure provider API keys."
        _update_deployment(status="requires_configuration", result={"error": msg})
        return {"ok": False, "error": msg}

    # Unsupported type
    msg = f"Unsupported database type: {db_type}"
    _update_deployment(status="error", result={"error": msg})
    return {"ok": False, "error": msg}
