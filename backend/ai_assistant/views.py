import re

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from databases.models import DatabaseConnection
from query_engine.services import QueryExecutionError, QueryExecutionService


LIMIT_PATTERN = re.compile(r"\bLIMIT\s+\d+\b", re.IGNORECASE)
SELECT_ALL_PATTERN = re.compile(r"^\s*SELECT\s+\*\s+FROM\s+", re.IGNORECASE)


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

    def post(self, request):
        sql = (request.data.get('sql') or '').strip()
        connection_id = request.data.get("connection_id")
        if not sql:
            return Response({"error": "No SQL provided"}, status=status.HTTP_400_BAD_REQUEST)
        if not connection_id:
            return Response({"error": "connection_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            connection = DatabaseConnection.objects.get(pk=connection_id)
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
