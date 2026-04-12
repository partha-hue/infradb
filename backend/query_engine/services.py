from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from time import perf_counter_ns

from django.utils import timezone

from databases.models import DatabaseConnection

from .engine_client import NativeEngineClient
from .models import QueryJob


READ_QUERY_PREFIXES = {"SELECT", "WITH", "PRAGMA", "EXPLAIN"}
ROW_PREVIEW_LIMIT = 500
ENABLE_NATIVE_SCAN_METRICS = os.environ.get("INFRA_ENABLE_NATIVE_SCAN_METRICS", "0").lower() in {"1", "true", "yes", "on"}


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

        native_metrics = (
            self.native_client.scan_database(connection.file_path)
            if ENABLE_NATIVE_SCAN_METRICS and connection.file_path
            else {"available": False}
        )
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
        statements = self._split_sql_statements(statement)
        if not statements:
            raise QueryExecutionError("SQL statement is empty.")
        if len(statements) == 1:
            return self._execute_single_sqlite_statement(connection, statements[0])
        return self._execute_multi_sqlite_script(connection, statements)

    def _execute_single_sqlite_statement(self, connection: DatabaseConnection, statement: str):
        query_type = statement.split(None, 1)[0].upper()
        truncated = False

        with self._connect_sqlite(connection) as db:
            cursor = db.cursor()
            try:
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

    def _execute_multi_sqlite_script(self, connection: DatabaseConnection, statements: list[str]):
        query_type = "MULTI"
        truncated = False
        columns = []
        rows = []
        rows_affected = 0

        with self._connect_sqlite(connection) as db:
            cursor = db.cursor()
            try:
                db.execute("BEGIN;")
                for stmt in statements:
                    sql = stmt.strip()
                    if not sql:
                        continue

                    statement_type = sql.split(None, 1)[0].upper()
                    cursor.execute(sql)

                    if statement_type in READ_QUERY_PREFIXES:
                        columns = [{"name": item[0], "type": "text"} for item in (cursor.description or [])]
                        rows = [dict(row) for row in cursor.fetchmany(ROW_PREVIEW_LIMIT + 1)]
                        if len(rows) > ROW_PREVIEW_LIMIT:
                            truncated = True
                            rows = rows[:ROW_PREVIEW_LIMIT]
                        rows_affected = len(rows)
                    else:
                        rows_affected += cursor.rowcount if cursor.rowcount != -1 else 0
                db.commit()
            except sqlite3.Error as exc:
                db.rollback()
                raise QueryExecutionError(str(exc)) from exc

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

        db = sqlite3.connect(db_path, timeout=30, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL;")
        db.execute("PRAGMA synchronous=NORMAL;")
        db.execute("PRAGMA temp_store=MEMORY;")
        db.execute("PRAGMA foreign_keys=ON;")
        return db

    def _split_sql_statements(self, sql: str):
        statements = []
        current = []
        in_single = False
        in_double = False
        escape = False

        for ch in sql:
            if escape:
                current.append(ch)
                escape = False
                continue
            if ch == "\\":
                current.append(ch)
                escape = True
                continue
            if ch == "'" and not in_double:
                in_single = not in_single
                current.append(ch)
                continue
            if ch == '"' and not in_single:
                in_double = not in_double
                current.append(ch)
                continue
            if ch == ";" and not in_single and not in_double:
                statement = "".join(current).strip()
                if statement:
                    statements.append(statement)
                current = []
                continue
            current.append(ch)

        leftover = "".join(current).strip()
        if leftover:
            statements.append(leftover)
        return statements

    def _normalize_statement(self, sql: str):
        statement = (sql or "").strip()
        if not statement:
            raise QueryExecutionError("SQL statement is empty.")
        return statement
