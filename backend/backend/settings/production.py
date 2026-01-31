# settings/production.py
from .base import *
import dj_database_url
import os

DEBUG = False

# SECURITY: The Guardian Settings
# Detect destructive queries without WHERE clauses
QUERY_GUARDIAN_ENABLED = True
STRICT_PROD_MODE = os.environ.get('STRICT_PROD_MODE', 'True').lower() == 'true'

# Parse ALLOWED_HOSTS from environment variable
allowed_hosts_str = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_str.split(',') if host.strip()]

if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['infradb-backend.onrender.com', 'infradb-app.vercel.app', 'localhost', '127.0.0.1']

# Database
db_from_env = dj_database_url.config(conn_max_age=600)
if db_from_env:
    DATABASES = {'default': db_from_env}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Production Security
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Performance: Connection Pooling
DATABASES['default']['CONN_MAX_AGE'] = 60

# CORS and CSRF
CORS_ALLOW_ALL_ORIGINS = False 
CORS_ALLOWED_ORIGINS = [
    'https://infradb-app.vercel.app',
]

CSRF_TRUSTED_ORIGINS = [
    'https://infradb-backend.onrender.com',
    'https://infradb-app.vercel.app'
]

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("CRITICAL: DJANGO_SECRET_KEY must be set in production")

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
