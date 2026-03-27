from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkspaceViewSet, ConnectionViewSet

router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet)
router.register(r'connections', ConnectionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
