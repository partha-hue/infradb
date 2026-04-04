from __future__ import annotations

import sqlite3
from pathlib import Path
from time import perf_counter_ns

from django.utils import timezone

from databases.models import DatabaseConnection

from .engine_client import NativeEngineClient
from .models import QueryJob


READ_QUERY_PREFIXES = {"SELECT", "WITH", "PRAGMA", "EXPLAIN"}
ROW_PREVIEW_LIMIT = 500


class QueryExecutionError(Exception):
    pass


class QueryExecutionService:
    def __init__(self):
        self.native_client = NativeEngineClient()

    def execute(self, *, connection: DatabaseConnection, sql: str, actor):
        statement = self._normalize_statement(sql)
        job = QueryJob.objects.create(
            user=actor,
            connection=connection,
            sql_query=statement,
            status="RUNNING",
            started_at=timezone.now(),
        )

        started_ns = perf_counter_ns()
        try:
            payload = self._execute_sqlite(connection, statement)
        except Exception as exc:
            duration_ms = round((perf_counter_ns() - started_ns) / 1_000_000, 3)
            job.status = "FAILED"
            job.execution_time_ms = duration_ms
            job.error_message = str(exc)
            job.finished_at = timezone.now()
            job.save(update_fields=["status", "execution_time_ms", "error_message", "finished_at"])
            raise

        native_metrics = self.native_client.scan_database(connection.file_path) if connection.file_path else {"available": False}
        duration_ms = round((perf_counter_ns() - started_ns) / 1_000_000, 3)

        job.status = "COMPLETED"
        job.execution_time_ms = duration_ms
        job.rows_affected = payload["rows_affected"]
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "execution_time_ms", "rows_affected", "finished_at"])

        return {
            "job_id": str(job.id),
            "status": job.status,
            "results": payload["rows"],
            "columns": payload["columns"],
            "rows_returned": len(payload["rows"]),
            "rows_affected": payload["rows_affected"],
            "execution_time_ms": duration_ms,
            "truncated": payload["truncated"],
            "query_type": payload["query_type"],
            "engine": {
                "execution_mode": "sqlite",
                "native_acceleration": native_metrics.get("available", False),
                "native": native_metrics,
            },
        }

    def explain(self, *, connection: DatabaseConnection, sql: str):
        statement = self._normalize_statement(sql)

        try:
            with self._connect_sqlite(connection) as db:
                cursor = db.execute(f"EXPLAIN QUERY PLAN {statement}")
                rows = cursor.fetchall()
        except sqlite3.Error as exc:
            raise QueryExecutionError(str(exc)) from exc

        plan = [
            {
                "select_id": row[0],
                "order": row[1],
                "from": row[2],
                "detail": row[3],
            }
            for row in rows
        ]
        return {
            "plan": plan,
            "explanation": "SQLite execution plan generated from the current connection.",
            "estimated_cost": len(plan),
        }

    def history(self, *, actor, limit=50):
        queryset = (
            QueryJob.objects.filter(user=actor)
            .select_related("connection")
            .order_by("-created_at")[:limit]
        )
        return [
            {
                "id": str(job.id),
                "sql": job.sql_query,
                "status": "SUCCESS" if job.status == "COMPLETED" else job.status,
                "duration_ms": job.execution_time_ms or 0,
                "timestamp": job.created_at.isoformat(),
                "connection_name": job.connection.name,
                "error_message": job.error_message,
            }
            for job in queryset
        ]

    def job_status(self, *, job: QueryJob):
        return {
            "job_id": str(job.id),
            "status": job.status,
            "execution_time_ms": job.execution_time_ms,
            "rows_affected": job.rows_affected,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        }

    def _execute_sqlite(self, connection: DatabaseConnection, statement: str):
        query_type = statement.split(None, 1)[0].upper()
        truncated = False

        with self._connect_sqlite(connection) as db:
            try:
                cursor = db.cursor()
                cursor.execute(statement)
            except sqlite3.Error as exc:
                raise QueryExecutionError(str(exc)) from exc

            if query_type in READ_QUERY_PREFIXES:
                columns = [{"name": item[0], "type": "text"} for item in (cursor.description or [])]
                rows = [dict(row) for row in cursor.fetchmany(ROW_PREVIEW_LIMIT + 1)]
                if len(rows) > ROW_PREVIEW_LIMIT:
                    truncated = True
                    rows = rows[:ROW_PREVIEW_LIMIT]
                rows_affected = len(rows)
            else:
                db.commit()
                columns = []
                rows = []
                rows_affected = cursor.rowcount if cursor.rowcount != -1 else 0

        return {
            "query_type": query_type,
            "columns": columns,
            "rows": rows,
            "rows_affected": rows_affected,
            "truncated": truncated,
        }

    def _connect_sqlite(self, connection: DatabaseConnection):
        if connection.engine != "SQLITE":
            raise QueryExecutionError(f"{connection.engine} execution is not configured in this deployment.")

        db_path = Path(connection.file_path)
        if not db_path.exists():
            raise QueryExecutionError(f"SQLite database not found: {db_path}")

        db = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL;")
        db.execute("PRAGMA synchronous=NORMAL;")
        db.execute("PRAGMA temp_store=MEMORY;")
        db.execute("PRAGMA foreign_keys=ON;")
        return db

    def _normalize_statement(self, sql: str):
        statement = (sql or "").strip()
        if not statement:
            raise QueryExecutionError("SQL statement is empty.")

        trimmed = statement[:-1] if statement.endswith(";") else statement
        if ";" in trimmed:
            raise QueryExecutionError("Only a single SQL statement is supported per execution.")
        return statement
