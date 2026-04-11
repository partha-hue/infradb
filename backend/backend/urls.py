from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

def healthcheck(_request):
    return JsonResponse({"status": "ok", "service": "infradb-backend"})

urlpatterns = [
    path('', healthcheck, name='root-healthcheck'),
    path('healthz/', healthcheck, name='healthcheck'),
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/v1/databases/', include('databases.urls')),
    path('api/v1/query/', include('query_engine.urls')),
    path('api/v1/ai/', include('ai_assistant.urls')),
]
