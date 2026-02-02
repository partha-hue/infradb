# backend/core/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Authentication
    path('auth/login/', views.login, name='login'),
    path('auth/register/', views.register, name='register'),
    
    # System Status
    path('system/info/', views.system_info, name='system_info'),
    
    # Database Connection
    path('connect/', views.connect, name='connect'),
    path('disconnect/', views.disconnect, name='disconnect'),
    path('schema/', views.schema, name='schema'),
    
    # Query Operations
    path('queries/run/', views.run_query, name='run_query'),
    path('queries/explain/', views.explain_query, name='explain_query'),
    path('queries/recommend-indexes/', views.recommend_indexes, name='recommend_indexes'),
    path('queries/history/', views.query_history, name='query_history'),
    path('queries/save/', views.save_query, name='save_query'),
    path('queries/saved/', views.get_saved_queries, name='get_saved_queries'),
    
    # Database Management
    path('databases/create/', views.create_database, name='create_database'),
    path('databases/list/', views.list_databases, name='list_databases'),
    
    # Data Import/Export
    path('import-file/', views.import_file, name='import_file'),
    path('export-data/', views.export_data, name='export_data'),
    path('import-csv/', views.import_csv, name='import_csv'),
    path('import-excel/', views.import_excel, name='import_excel'),
    
    # ER Diagram
    path('er-diagram/', views.er_diagram, name='er_diagram'),
    path('ping/', views.ping, name='ping'),
    # Load sample DB for onboarding
    path('load-sample-db/', views.load_sample_db, name='load_sample_db'),
    
    # AI Features
    path('ai/query_suggest/', views.ai_query_suggest, name='ai_query_suggest'),
    path('ai/analyze_schema/', views.ai_analyze_schema, name='ai_analyze_schema'),

    # Schema Engine (Bidirectional Sync)
    path('schema/sql-to-designer/', views.sql_to_designer, name='sql_to_designer'),
    path('schema/designer-to-sql/', views.designer_to_sql, name='designer_to_sql'),
]
