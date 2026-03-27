from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import QueryJob
from .serializers import QueryJobSerializer
from .engine_client import EngineClient
import threading

class QueryViewSet(viewsets.ModelViewSet):
    queryset = QueryJob.objects.all()
    serializer_class = QueryJobSerializer
    engine_client = EngineClient()

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def run(self, request):
        sql_query = request.data.get('sql')
        connection_id = request.data.get('connection_id')

        if not sql_query or not connection_id:
            return Response({"error": "Missing sql or connection_id"}, status=status.HTTP_400_BAD_REQUEST)

        # Create Job Record
        job = QueryJob.objects.create(
            user=request.user,
            connection_id=connection_id,
            sql_query=sql_query,
            status='RUNNING'
        )

        # In a real production environment, this would be dispatched to a Celery worker
        # or handled via an async gRPC call to keep the request/response cycle short.
        def execute():
            result = self.engine_client.execute_query(sql_query, connection_id)
            if "error" in result and result["error"]:
                job.status = 'FAILED'
                job.error_message = result["error"]
            else:
                job.status = 'COMPLETED'
                job.execution_time_ms = result.get('execution_time_ms')
                job.rows_affected = result.get('rows_affected')
            job.save()

        # Simple thread for demonstration; use Celery in full prod
        threading.Thread(target=execute).start()

        return Response({
            "job_id": str(job.id),
            "status": job.status
        }, status=status.HTTP_202_ACCEPTED)
