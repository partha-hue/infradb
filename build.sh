#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- Starting Build Process ---"

# --- BACKEND BUILD ---
echo "Installing Backend Dependencies..."
pip install -r backend/requirements.txt

echo "Running Database Migrations..."
# Check if manage.py exists before running
if [ -f backend/manage.py ]; then
    python backend/manage.py migrate --no-input
else
    echo "Warning: backend/manage.py not found, skipping migrations."
fi

echo "Build Completed Successfully!"
