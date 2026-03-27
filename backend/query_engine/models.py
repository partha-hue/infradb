from django.db import models
from django.conf import settings
from databases.models import DatabaseConnection
import uuid

class QueryJob(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    connection = models.ForeignKey(DatabaseConnection, on_delete=models.CASCADE)
    sql_query = models.TextField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    # Performance Metrics
    execution_time_ms = models.FloatField(null=True, blank=True)
    rows_affected = models.BigIntegerField(null=True, blank=True)
    data_scanned_bytes = models.BigIntegerField(null=True, blank=True)
    
    error_message = models.TextField(null=True, blank=True)
    
    # Results can be stored in S3/Object storage and referenced here
    results_path = models.CharField(max_length=512, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Job {self.id} - {self.status}"
