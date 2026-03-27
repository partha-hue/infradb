#!/bin/bash
# Exit on error
set -e

echo "--- InfraDB Production Build Starting ---"

# Install Python dependencies
if [ -f "backend/requirements.txt" ]; then
    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r backend/requirements.txt
else
    echo "Error: backend/requirements.txt not found"
    exit 1
fi

# Run Migrations
if [ -f "backend/manage.py" ]; then
    echo "Running migrations..."
    python backend/manage.py migrate --no-input
else
    echo "Warning: backend/manage.py not found"
fi

echo "--- Build Successful ---"
