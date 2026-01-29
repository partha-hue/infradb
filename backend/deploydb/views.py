from rest_framework import generics, permissions
from .models import Deployment
from .serializers import DeploymentSerializer
from .tasks import create_user_database  # your celery task
from rest_framework.views import APIView
from rest_framework.response import Response

class DeploymentListCreateAPI(generics.ListCreateAPIView):
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated access for dev

    def get_queryset(self):
        if self.request.user and self.request.user.is_authenticated:
            return Deployment.objects.filter(user=self.request.user)
        return Deployment.objects.none()

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        instance = serializer.save(user=user, status="pending")
        # Pass deployment id and validated data to the task. Use .delay() if Celery is available,
        # otherwise call synchronously (fallback provided in tasks.py).
        payload = {
            "deployment_id": str(instance.id),
            "user_id": user.id if user else None,
            **serializer.validated_data,
        }

        try:
            # If Celery is present, .delay will enqueue and return an AsyncResult-like object
            res = create_user_database.delay(payload)
            task_id = getattr(res, "id", None) or getattr(res, "task_id", None)
            if task_id:
                instance.celery_task_id = task_id
                instance.status = "provisioning"
                instance.save()
                return
        except Exception:
            # If .delay doesn't exist or fails, call synchronously
            pass

        # Synchronous fallback
        result = create_user_database(payload)
        instance.result = result if isinstance(result, str) else (result and str(result))
        instance.status = "ready" if result and (not isinstance(result, dict) or result.get("ok", True)) else "error"
        instance.save()

class DeploymentDetailAPI(generics.RetrieveAPIView):
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated access for dev

    def get_queryset(self):
        if self.request.user and self.request.user.is_authenticated:
            return Deployment.objects.filter(user=self.request.user)
        return Deployment.objects.all()


class DeploymentPublicListAPI(generics.ListAPIView):
    """Public list of created deployments/databases for the UI to display.

    Development convenience endpoint that returns all deployments (read-only).
    """
    serializer_class = DeploymentSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Deployment.objects.all().order_by("-created_at")


class DeploymentStatusAPI(APIView):
    """Return minimal deployment status for polling by the frontend.

    URL: /api/deploydb/status/<uuid:pk>/
    """
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated access for dev

    def get(self, request, pk):
        if request.user and request.user.is_authenticated:
            dep = Deployment.objects.filter(id=pk, user=request.user).first()
        else:
            dep = Deployment.objects.filter(id=pk).first()
        if not dep:
            return Response({"error": "Not found"}, status=404)
        return Response({
            "id": str(dep.id),
            "status": dep.status,
            "celery_task_id": dep.celery_task_id,
            "result": dep.result,
            "db_name": dep.db_name,
            "db_type": dep.db_type,
            "created_at": dep.created_at,
        })

# Add teardown/delete/status as extra views as needed
