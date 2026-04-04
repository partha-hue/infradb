from pathlib import Path

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from databases.models import DatabaseConnection
from databases.services import ConsoleBootstrapService

from .models import QueryJob
from .serializers import QueryJobSerializer
from .services import QueryExecutionError, QueryExecutionService


class QueryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = QueryJob.objects.all().select_related("connection")
    serializer_class = QueryJobSerializer
    permission_classes = [permissions.AllowAny]
    execution_service = QueryExecutionService()
    bootstrap = ConsoleBootstrapService(Path(__file__).resolve().parent.parent)

    def get_queryset(self):
        actor = self.bootstrap.get_actor(getattr(self.request, "user", None))
        return self.queryset.filter(user=actor).order_by("-created_at")

    @action(detail=False, methods=['post'])
    def run(self, request):
        sql_query = request.data.get('sql')
        connection_id = request.data.get('connection_id')

        if not sql_query or not connection_id:
            return Response({"error": "Missing sql or connection_id"}, status=status.HTTP_400_BAD_REQUEST)

        actor = self.bootstrap.get_actor(getattr(request, "user", None))
        try:
            connection = DatabaseConnection.objects.get(pk=connection_id, workspace__owner=actor)
        except DatabaseConnection.DoesNotExist:
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = self.execution_service.execute(connection=connection, sql=sql_query, actor=actor)
        except QueryExecutionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def history(self, request):
        actor = self.bootstrap.get_actor(getattr(request, "user", None))
        limit = int(request.query_params.get("limit", 50))
        return Response({"items": self.execution_service.history(actor=actor, limit=min(limit, 200))})

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        job = self.get_object()
        return Response(self.execution_service.job_status(job=job))

    @action(detail=False, methods=["post"])
    def explain(self, request):
        sql_query = request.data.get("sql")
        connection_id = request.data.get("connection_id")

        if not sql_query or not connection_id:
            return Response({"error": "Missing sql or connection_id"}, status=status.HTTP_400_BAD_REQUEST)

        actor = self.bootstrap.get_actor(getattr(request, "user", None))
        try:
            connection = DatabaseConnection.objects.get(pk=connection_id, workspace__owner=actor)
        except DatabaseConnection.DoesNotExist:
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            payload = self.execution_service.explain(connection=connection, sql=sql_query)
        except QueryExecutionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(payload)
