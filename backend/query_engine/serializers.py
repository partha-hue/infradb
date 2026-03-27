from rest_framework import serializers
from .models import QueryJob

class QueryJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = QueryJob
        fields = '__all__'
        read_only_fields = ['user', 'status', 'execution_time_ms', 'rows_affected', 'data_scanned_bytes', 'error_message', 'results_path', 'started_at', 'finished_at']
