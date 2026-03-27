from rest_framework import serializers
from .models import Workspace, DatabaseConnection, SchemaMetadata

class DatabaseConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatabaseConnection
        fields = ['id', 'name', 'engine', 'host', 'port', 'database_name', 'username', 'is_active', 'created_at']
        extra_kwargs = {'password': {'write_only': True}}

class WorkspaceSerializer(serializers.ModelSerializer):
    connections = DatabaseConnectionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Workspace
        fields = ['id', 'name', 'owner', 'connections', 'created_at', 'updated_at']
        read_only_fields = ['owner']

class SchemaMetadataSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchemaMetadata
        fields = '__all__'
