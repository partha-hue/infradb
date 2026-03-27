#!/usr/bin/env bash
# Exit on error
set -o errexit

# --- BACKEND BUILD ---
echo "Installing Backend Dependencies..."
pip install -r backend/requirements.txt

echo "Collecting Static Files..."
python backend/manage.py collectstatic --no-input

echo "Running Database Migrations..."
python backend/manage.py migrate --no-input

echo "Seeding Startup Data..."
python backend/manage.py seed_db

echo "Build Completed Successfully!"
