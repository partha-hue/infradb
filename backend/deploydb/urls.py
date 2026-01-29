from django.urls import path
from .views import (
    DeploymentListCreateAPI,
    DeploymentDetailAPI,
    DeploymentPublicListAPI,
    DeploymentStatusAPI,
    # Add teardown/status/delete as needed
)

urlpatterns = [
    path("", DeploymentListCreateAPI.as_view(), name="deployment_list_create"),
    path("<uuid:pk>/", DeploymentDetailAPI.as_view(), name="deployment_detail"),
    path("status/<uuid:pk>/", DeploymentStatusAPI.as_view(), name="deployment_status"),
    path("public/", DeploymentPublicListAPI.as_view(), name="deployment_public_list"),
    # Add more: teardown, delete, status...
]
