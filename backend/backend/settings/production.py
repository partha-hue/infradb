# settings/production.py
from .base import *
import dj_database_url
import os

DEBUG = False

# Parse ALLOWED_HOSTS from environment variable
allowed_hosts_str = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_str.split(',') if host.strip()]

# Fallback if empty
if not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['infradb-backend.onrender.com', '.onrender.com']

# Database
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL'),
        conn_max_age=600
    )
}

# CSRF settings
csrf_origins_str = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in csrf_origins_str.split(',') if origin.strip()]

if not CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS = ['https://infradb-backend.onrender.com']

# CORS settings
cors_origins_str = os.environ.get('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in cors_origins_str.split(',') if origin.strip()]

if not CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS = ['https://infradb-backend.onrender.com']

CORS_ALLOW_CREDENTIALS = True

# Security settings (relaxed for now)
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'SAMEORIGIN'

SECRET_KEY = os.environ.get('SECRET_KEY')

# Static files
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATIC_URL = '/static/'
