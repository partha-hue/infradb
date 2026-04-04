from pathlib import Path
import sqlite3

from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import DatabaseConnection, Workspace
from .serializers import DatabaseConnectionSerializer, WorkspaceSerializer
from .services import ConsoleBootstrapService


bootstrap = ConsoleBootstrapService(Path(__file__).resolve().parent.parent)


def _sqlite_schema(file_path: str):
    if not file_path:
        return []

    db_path = Path(file_path)
    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {db_path}")

    with sqlite3.connect(db_path) as connection:
        tables = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()

        schema = []
        for (table_name,) in tables:
            columns = connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()
            schema.append(
                {
                    "table": table_name,
                    "columns": [
                        {
                            "name": column[1],
                            "type": column[2],
                            "nullable": not bool(column[3]),
                            "default": column[4],
                            "primary_key": bool(column[5]),
                        }
                        for column in columns
                    ],
                }
            )
        return schema


class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        actor = bootstrap.get_actor(getattr(self.request, "user", None))
        bootstrap.ensure_default_workspace(actor)
        return Workspace.objects.filter(owner=actor).prefetch_related("connections")

    def perform_create(self, serializer):
        serializer.save(owner=bootstrap.get_actor(getattr(self.request, "user", None)))


class ConnectionViewSet(viewsets.ModelViewSet):
    serializer_class = DatabaseConnectionSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        actor = bootstrap.get_actor(getattr(self.request, "user", None))
        bootstrap.ensure_default_workspace(actor)
        return DatabaseConnection.objects.filter(workspace__owner=actor).select_related("workspace")

    @action(detail=False, methods=["post"], url_path="test")
    def test_connection(self, request):
        payload = request.data
        engine = str(payload.get("engine", "SQLITE")).upper()
        file_path = payload.get("file_path") or payload.get("database") or payload.get("database_name")

        if engine == "SQLITE":
            if not file_path:
                return Response(
                    {"ok": False, "error": "SQLite connections require a file_path or database name."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            db_path = Path(file_path)
            if not db_path.is_absolute():
                db_path = Path(__file__).resolve().parent.parent / file_path
            if not db_path.exists():
                return Response(
                    {"ok": False, "error": f"SQLite database not found: {db_path}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({"ok": True, "engine": engine, "database_path": str(db_path)})

        return Response(
            {
                "ok": False,
                "error": f"{engine} connectivity is not configured in this deployment yet.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=["get"])
    def schema(self, request, pk=None):
        connection = self.get_object()

        if connection.engine != "SQLITE":
            return Response(
                {"tables": [], "error": f"Schema introspection is not configured for {connection.engine}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tables = _sqlite_schema(connection.file_path)
        except FileNotFoundError as exc:
            return Response({"tables": [], "error": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except sqlite3.Error as exc:
            return Response({"tables": [], "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "connection_id": str(connection.id),
                "database_name": connection.database_name,
                "tables": tables,
            }
        )
