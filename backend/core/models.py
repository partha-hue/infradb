# backend/core/models.py
from django.db import models
from django.contrib.auth.models import User

class QueryHistory(models.Model):
    query = models.TextField()
    execution_time = models.FloatField(default=0.0)  # milliseconds
    row_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'query_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.query[:50]}... ({self.created_at})"

class SavedQuery(models.Model):
    title = models.CharField(max_length=255)
    query = models.TextField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        db_table = 'saved_queries'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
