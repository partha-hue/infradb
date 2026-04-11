import re
from pathlib import Path

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from databases.models import DatabaseConnection
from databases.services import ConsoleBootstrapService
from query_engine.services import QueryExecutionError, QueryExecutionService


LIMIT_PATTERN = re.compile(r"\bLIMIT\s+\d+\b", re.IGNORECASE)
SELECT_ALL_PATTERN = re.compile(r"^\s*SELECT\s+\*\s+FROM\s+", re.IGNORECASE)
OPTIMIZE_HINT_PATTERN = re.compile(r"\b(optimi[sz]e|faster|performance)\b", re.IGNORECASE)
EXPLAIN_HINT_PATTERN = re.compile(r"\b(explain|plan)\b", re.IGNORECASE)
FIX_HINT_PATTERN = re.compile(r"\b(fix|syntax|error|typo)\b", re.IGNORECASE)


class QueryOptimizeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        sql = (request.data.get('sql') or '').strip()
        if not sql:
            return Response({"error": "No SQL provided"}, status=status.HTTP_400_BAD_REQUEST)

        optimized_sql = sql
        recommendations = []

        if SELECT_ALL_PATTERN.search(sql):
            recommendations.append("Replace SELECT * with explicit columns on hot paths to reduce row materialization cost.")

        if sql.upper().startswith("SELECT") and not LIMIT_PATTERN.search(sql):
            optimized_sql = f"{sql.rstrip(';')} LIMIT 200;"
            recommendations.append("Added a LIMIT guard to keep interactive console execution bounded.")

        if " ORDER BY " in sql.upper():
            recommendations.append("Review the ORDER BY columns and back them with an index when cardinality is high.")

        if " WHERE " not in sql.upper() and sql.upper().startswith("SELECT"):
            recommendations.append("Unfiltered full scans should be reserved for analytics workloads or background jobs.")

        if not recommendations:
            recommendations.append("The statement is already compact. Primary optimization opportunity is index design and data layout.")

        return Response(
            {
                "original_sql": sql,
                "optimized_sql": optimized_sql,
                "explanation": "Applied deterministic SQL console heuristics for low-latency interactive execution.",
                "recommendations": recommendations,
            }
        )


class QueryExplainView(APIView):
    permission_classes = [permissions.AllowAny]
    bootstrap = ConsoleBootstrapService(Path(__file__).resolve().parent.parent)

    def post(self, request):
        sql = (request.data.get('sql') or '').strip()
        connection_id = request.data.get("connection_id")
        if not sql:
            return Response({"error": "No SQL provided"}, status=status.HTTP_400_BAD_REQUEST)
        if not connection_id:
            return Response({"error": "connection_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        actor = self.bootstrap.get_actor(getattr(request, "user", None))
        try:
            connection = DatabaseConnection.objects.get(pk=connection_id, workspace__owner=actor)
        except DatabaseConnection.DoesNotExist:
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)

        service = QueryExecutionService()
        try:
            payload = service.explain(connection=connection, sql=sql)
        except QueryExecutionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(payload)


class QueryFixSyntaxView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        sql = (request.data.get("sql") or "").strip()
        if not sql:
            return Response({"error": "No SQL provided"}, status=status.HTTP_400_BAD_REQUEST)

        fixed_sql = sql
        fixes = []

        if not fixed_sql.endswith(";"):
            fixed_sql = f"{fixed_sql};"
            fixes.append("Added a terminating semicolon.")

        fixed_sql = re.sub(r"\bSELEC\b", "SELECT", fixed_sql, flags=re.IGNORECASE)
        if fixed_sql != sql and "Corrected a SELECT typo." not in fixes:
            fixes.append("Corrected a SELECT typo.")

        if not fixes:
            fixes.append("No obvious syntax issue detected. Validate dialect-specific functions and identifiers.")

        return Response(
            {
                "original_sql": sql,
                "fixed_sql": fixed_sql,
                "explanation": "Applied deterministic console-safe syntax fixes.",
                "fixes": fixes,
            }
        )


class QueryChatView(APIView):
    permission_classes = [permissions.AllowAny]
    bootstrap = ConsoleBootstrapService(Path(__file__).resolve().parent.parent)

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        sql = (request.data.get("sql") or "").strip()
        connection_id = request.data.get("connection_id")

        if not message:
            return Response({"error": "message is required"}, status=status.HTTP_400_BAD_REQUEST)

        if not sql:
            return Response(
                {
                    "message": "Please provide SQL in the editor and I can optimize, explain, or fix it.",
                    "intent": "general",
                }
            )

        if FIX_HINT_PATTERN.search(message):
            fixed_sql = sql
            fixes = []
            if not fixed_sql.endswith(";"):
                fixed_sql = f"{fixed_sql};"
                fixes.append("Added a terminating semicolon.")
            fixed_sql = re.sub(r"\bSELEC\b", "SELECT", fixed_sql, flags=re.IGNORECASE)
            if fixed_sql != sql and "Corrected a SELECT typo." not in fixes:
                fixes.append("Corrected a SELECT typo.")
            if not fixes:
                fixes.append("No obvious syntax issue detected.")
            return Response(
                {
                    "intent": "fix-syntax",
                    "message": "I applied syntax-safe fixes to the current SQL.",
                    "fixed_sql": fixed_sql,
                    "fixes": fixes,
                    "explanation": "Applied deterministic syntax repair heuristics.",
                }
            )

        if EXPLAIN_HINT_PATTERN.search(message):
            if not connection_id:
                return Response({"error": "connection_id is required for explain requests"}, status=status.HTTP_400_BAD_REQUEST)
            actor = self.bootstrap.get_actor(getattr(request, "user", None))
            try:
                connection = DatabaseConnection.objects.get(pk=connection_id, workspace__owner=actor)
            except DatabaseConnection.DoesNotExist:
                return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)

            service = QueryExecutionService()
            try:
                payload = service.explain(connection=connection, sql=sql)
            except QueryExecutionError as exc:
                return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            payload["intent"] = "explain"
            payload["message"] = "Execution plan generated for the current SQL."
            return Response(payload)

        if OPTIMIZE_HINT_PATTERN.search(message) or message.lower().startswith("/opt"):
            optimized_sql = sql
            recommendations = []
            if SELECT_ALL_PATTERN.search(sql):
                recommendations.append("Replace SELECT * with explicit columns for lower scan and transfer cost.")
            if sql.upper().startswith("SELECT") and not LIMIT_PATTERN.search(sql):
                optimized_sql = f"{sql.rstrip(';')} LIMIT 200;"
                recommendations.append("Added LIMIT 200 for interactive execution safety.")
            if " ORDER BY " in sql.upper():
                recommendations.append("Ensure ORDER BY columns are indexed.")
            if not recommendations:
                recommendations.append("Query shape is already compact; focus on indexes and stats.")

            return Response(
                {
                    "intent": "optimize",
                    "message": "I generated an optimized variant of your SQL.",
                    "optimized_sql": optimized_sql,
                    "recommendations": recommendations,
                    "explanation": "Applied deterministic optimization heuristics for console workloads.",
                }
            )

        return Response(
            {
                "intent": "general",
                "message": "I can optimize, explain, or fix syntax. Try: 'optimize this query', 'explain plan', or 'fix syntax'.",
            }
        )
