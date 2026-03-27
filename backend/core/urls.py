from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login, name='login'),
    path('auth/register/', views.register, name='register'),
    path('connect/', views.connect, name='connect'),
    path('disconnect/', views.disconnect, name='disconnect'),
    path('queries/run/', views.run_query, name='run_query'),
    path('schema/', views.schema, name='schema'),
    path('system/info/', views.system_info, name='system_info'),
    path('ai/query_suggest/', views.ai_query_suggest, name='ai_query_suggest'),
]
