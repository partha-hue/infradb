from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import DatabaseConnection, Workspace


User = get_user_model()


@dataclass(frozen=True)
class SeedConnection:
    name: str
    engine: str
    database_name: str
    file_path: str


class ConsoleBootstrapService:
    DEFAULT_WORKSPACE_NAME = "InfraDB Control Plane"
    DEFAULT_USERNAME = "console"

    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)

    def get_actor(self, request_user=None):
        if request_user and getattr(request_user, "is_authenticated", False):
            return request_user
        return self._ensure_console_user()

    @transaction.atomic
    def ensure_default_workspace(self, actor=None):
        actor = actor or self._ensure_console_user()
        workspace, _ = Workspace.objects.get_or_create(
            owner=actor,
            name=self.DEFAULT_WORKSPACE_NAME,
        )

        for spec in self._seed_connections():
            DatabaseConnection.objects.get_or_create(
                workspace=workspace,
                name=spec.name,
                defaults={
                    "engine": spec.engine,
                    "database_name": spec.database_name,
                    "file_path": spec.file_path,
                    "host": "",
                    "port": 0,
                    "username": "",
                    "password": "",
                    "is_active": True,
                },
            )

        return workspace

    def _ensure_console_user(self):
        user, created = User.objects.get_or_create(
            username=self.DEFAULT_USERNAME,
            defaults={
                "email": "console@local.infradb",
                "is_staff": False,
                "is_superuser": False,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
        return user

    def _seed_connections(self):
        sample_db = self.base_dir / "sample_db.sqlite3"
        primary_db = self.base_dir / "db.sqlite3"
        analytics_db = self.base_dir / "user_databases" / "test_db.sqlite3"

        return (
            SeedConnection(
                name="Production_DB",
                engine="SQLITE",
                database_name="prod_main",
                file_path=str(primary_db),
            ),
            SeedConnection(
                name="Testing_Env",
                engine="SQLITE",
                database_name="qa_env",
                file_path=str(sample_db),
            ),
            SeedConnection(
                name="Analytics_Warehouse",
                engine="SQLITE",
                database_name="analytics",
                file_path=str(analytics_db if analytics_db.exists() else primary_db),
            ),
        )
