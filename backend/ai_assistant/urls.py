from django.urls import path
from .views import QueryExplainView, QueryFixSyntaxView, QueryOptimizeView

urlpatterns = [
    path('optimize/', QueryOptimizeView.as_view(), name='query-optimize'),
    path('explain/', QueryExplainView.as_view(), name='query-explain'),
    path('fix-syntax/', QueryFixSyntaxView.as_view(), name='query-fix-syntax'),
]
