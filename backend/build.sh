#!/usr/bin/env bash
# exit on error
set -o errexit

echo "--- Starting InfraDB Backend Build ---"

# Root directory is 'backend' in Render settings
pip install --upgrade pip
pip install -r requirements.txt

# Generate gRPC Python code
echo "Generating gRPC stubs..."
python -m grpc_tools.protoc -I../native/proto --python_out=. --grpc_python_out=. ../native/proto/engine.proto

# Run migrations
python manage.py migrate --no-input

# Collect static files
python manage.py collectstatic --no-input

echo "--- Build Complete ---"
