from django.db import models
from django.conf import settings
import uuid

class Workspace(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='workspaces')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class DatabaseConnection(models.Model):
    ENGINE_CHOICES = [
        ('SQLITE', 'SQLite'),
        ('INFRADB', 'InfraDB Native'),
        ('POSTGRES', 'PostgreSQL'),
        ('MYSQL', 'MySQL'),
        ('SNOWFLAKE', 'Snowflake'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='connections')
    name = models.CharField(max_length=255)
    engine = models.CharField(max_length=50, choices=ENGINE_CHOICES, default='INFRADB')

    # Connection details. In production, secrets should be encrypted and fetched from a vault.
    host = models.CharField(max_length=255, blank=True, default='')
    port = models.IntegerField(default=0)
    database_name = models.CharField(max_length=255)
    username = models.CharField(max_length=255, blank=True, default='')
    password = models.CharField(max_length=255, blank=True, default='')
    file_path = models.CharField(max_length=512, blank=True, default='')

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.engine})"

class SchemaMetadata(models.Model):
    connection = models.ForeignKey(DatabaseConnection, on_delete=models.CASCADE, related_name='metadata')
    table_name = models.CharField(max_length=255)
    column_name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=100)
    is_nullable = models.BooleanField(default=True)
    last_synced = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('connection', 'table_name', 'column_name')
