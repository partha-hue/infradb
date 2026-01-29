try:
	from .celery_app import app as celery_app
except Exception:
	# Celery is optional in some dev setups. Fail gracefully if not installed/configured.
	celery_app = None

__all__ = ('celery_app',)
