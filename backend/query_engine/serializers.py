from rest_framework import serializers
from .models import QueryJob

class QueryJobSerializer(serializers.ModelSerializer):
    connection_name = serializers.CharField(source='connection.name', read_only=True)

    class Meta:
        model = QueryJob
        fields = '__all__'
        read_only_fields = ['user', 'status', 'execution_time_ms', 'rows_affected', 'data_scanned_bytes', 'error_message', 'results_path', 'started_at', 'finished_at']
