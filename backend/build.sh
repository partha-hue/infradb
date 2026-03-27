#!/usr/bin/env bash
# exit on error
set -o errexit

echo "--- Starting InfraDB Backend Build ---"

# Since Root Directory is 'backend', we are already inside the backend folder
pip install --upgrade pip
pip install -r requirements.txt

# Run migrations
python manage.py migrate --no-input

# Collect static files
python manage.py collectstatic --no-input

echo "--- Build Complete ---"
