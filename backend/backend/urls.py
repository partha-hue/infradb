from django.contrib import admin
from django.urls import path, include
from core import views as core_views
from django.conf import settings
from django.conf.urls.static import static




urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    # compatibility ping at top-level
    path("ping", core_views.ping),
    path("api/deploydb/", include("deploydb.urls")),
    path('api/deployments/', include('deploydb.urls')),


]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)