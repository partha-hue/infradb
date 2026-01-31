from django.db import models
from django.contrib.auth.models import User
import uuid

class UserProfile(models.Model):
    # Changed to null=True to facilitate migrations
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', null=True, blank=True)
    ROLE_CHOICES = [
        ('ADMIN', 'Admin'),
        ('DEVELOPER', 'Developer'),
        ('READ_ONLY', 'Read Only'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='DEVELOPER')

    def __str__(self):
        return f"{self.user.username if self.user else 'No User'} - {self.role}"

class DatabaseConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Changed to null=True to facilitate migrations
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='connections', null=True, blank=True)
    name = models.CharField(max_length=100)
    
    ENGINE_CHOICES = [
        ('mysql', 'MySQL'),
        ('postgresql', 'PostgreSQL'),
        ('mongodb', 'MongoDB'),
        ('sqlite', 'SQLite'),
    ]
    engine = models.CharField(max_length=20, choices=ENGINE_CHOICES)
    
    host = models.CharField(max_length=255, null=True, blank=True)
    port = models.IntegerField(null=True, blank=True)
    database = models.CharField(max_length=255)
    username = models.CharField(max_length=255, null=True, blank=True)
    password = models.TextField(null=True, blank=True)  # Store encrypted in production
    
    use_ssl = models.BooleanField(default=False)
    is_production = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'database_connections'

    def __str__(self):
        return f"{self.name} ({self.engine})"

class QueryHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Changed to null=True to facilitate migrations
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='query_history', null=True, blank=True)
    connection = models.ForeignKey(DatabaseConnection, on_delete=models.SET_NULL, null=True)
    query = models.TextField()
    execution_time = models.FloatField(default=0.0)  # milliseconds
    row_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, default='SUCCESS') # SUCCESS, FAILED, BLOCKED
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'query_history'
        ordering = ['-created_at']

class SavedQuery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Changed to null=True to facilitate migrations
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_queries', null=True, blank=True)
    title = models.CharField(max_length=255)
    query = models.TextField()
    connection_type = models.CharField(max_length=20, null=True, blank=True) # mysql, pg, etc
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'saved_queries'
        ordering = ['-created_at']

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255) # e.g., "CONNECT", "DROP TABLE", "EXPORT"
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
