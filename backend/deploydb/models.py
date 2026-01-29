from django.db import models
from django.contrib.auth import get_user_model
import uuid

class Deployment(models.Model):
    id = models.UUIDField(primary_key=True, editable=False, default=uuid.uuid4)
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE, null=True, blank=True)
    db_name = models.CharField(max_length=128)
    db_type = models.CharField(max_length=32)
    host = models.CharField(max_length=128, blank=True)
    port = models.CharField(max_length=8, blank=True)
    user_name = models.CharField(max_length=64, blank=True)
    # Don't store passwords unhashed in production!
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=32, default="pending")
    celery_task_id = models.CharField(max_length=50, blank=True, null=True)
    result = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.db_name} ({self.db_type})"
