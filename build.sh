#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- InfraDB Production Build Starting ---"

# Move to backend directory if needed, or assume root
# In your case, requirements.txt is in /backend

echo "Installing Python dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "Running Database Migrations..."
# Point to manage.py
python backend/manage.py migrate --no-input

echo "--- Build Successful ---"
