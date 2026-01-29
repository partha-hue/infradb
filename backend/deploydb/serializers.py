from rest_framework import serializers
from .models import Deployment

class DeploymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deployment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "status", "celery_task_id", "result", "user"]
