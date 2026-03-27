#!/usr/bin/env bash
# exit on error
set -o errexit

echo "--- Starting InfraDB Build ---"

# Install Python dependencies
# Using pip as fallback if poetry isn't used for the backend
pip install --upgrade pip
pip install -r backend/requirements.txt

# Run migrations
python backend/manage.py migrate --no-input

# Collect static files (needed for production)
python backend/manage.py collectstatic --no-input

echo "--- Build Complete ---"
