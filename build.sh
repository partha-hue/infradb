#!/bin/bash
set -e
echo "--- Starting InfraDB Build ---"
pip install -r backend/requirements.txt
python backend/manage.py migrate --no-input
echo "--- Build Complete ---"
