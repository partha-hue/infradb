from django.urls import path
from .views import QueryOptimizeView, QueryExplainView

urlpatterns = [
    path('optimize/', QueryOptimizeView.as_view(), name='query-optimize'),
    path('explain/', QueryExplainView.as_view(), name='query-explain'),
]
