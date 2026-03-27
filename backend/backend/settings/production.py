from .base import *
import dj_database_url

DEBUG = False
ALLOWED_HOSTS = ['*']  # Update this to your specific Render URL for security

# Use environment variables for secret production settings
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')

# Database configuration for production (using dj-database-url for Render Postgres)
DATABASES = {
    'default': dj_database_url.config(
        default='sqlite:///db.sqlite3',
        conn_max_age=600
    )
}

# In production, WhiteNoise should be used for static files
# Already configured in base.py
