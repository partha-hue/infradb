from django.urls import path
from .views import QueryChatView, QueryExplainView, QueryFixSyntaxView, QueryOptimizeView

urlpatterns = [
    path('optimize/', QueryOptimizeView.as_view(), name='query-optimize'),
    path('explain/', QueryExplainView.as_view(), name='query-explain'),
    path('fix-syntax/', QueryFixSyntaxView.as_view(), name='query-fix-syntax'),
    path('chat/', QueryChatView.as_view(), name='query-chat'),
]
