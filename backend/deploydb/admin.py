from django.contrib import admin
from .models import Deployment

@admin.register(Deployment)
class DeploymentAdmin(admin.ModelAdmin):
    readonly_fields = ('task_logs',)  # use existing method or field name

    list_display = (
        'db_name',
        'db_type',
        'user_name',  # correct field from your model
        'status',
        'created_at',
        'container_id_display',  # method for container id display
    )

    def task_logs(self, obj):
        # Example: Return logs as a string or HTML
        return getattr(obj, 'logs', 'No logs available')

    task_logs.short_description = 'Logs'

    def container_id_display(self, obj):
        # Return container id (assuming stored in result or another field)
        # Or None if not available
        return getattr(obj, 'container_id', None) or getattr(obj, 'result', None)

    container_id_display.short_description = 'Container ID'
