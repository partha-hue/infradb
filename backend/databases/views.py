from rest_framework import viewsets, permissions
from .models import Workspace, DatabaseConnection, SchemaMetadata
from .serializers import WorkspaceSerializer, DatabaseConnectionSerializer, SchemaMetadataSerializer

class WorkspaceViewSet(viewsets.ModelViewSet):
    queryset = Workspace.objects.all()
    serializer_class = WorkspaceSerializer

    def get_queryset(self):
        return self.queryset.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class ConnectionViewSet(viewsets.ModelViewSet):
    queryset = DatabaseConnection.objects.all()
    serializer_class = DatabaseConnectionSerializer

    def get_queryset(self):
        return self.queryset.filter(workspace__owner=self.request.user)
