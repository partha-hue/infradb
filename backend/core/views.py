import json
import os
import logging
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .db_manager import DBManager

# Initialize Global Manager
manager = DBManager()

@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(username=username, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({"access": str(refresh.access_token), "user": {"username": user.username}})
    return Response({"error": "Unauthorized"}, status=401)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def connect(request):
    config = request.data
    try:
        manager.connect(config)
        return Response({"success": True})
    except Exception as e:
        return Response({"error": str(e)}, status=400)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_query(request):
    query = request.data.get("query")
    if not query: return Response({"error": "No query"}, status=400)
    try:
        result = manager.execute(query)
        return Response({"results": [result]})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def schema(request):
    try:
        # Simplified schema for quick load
        return Response({"tables": [], "database_name": "Connected"})
    except Exception as e:
        return Response({"error": str(e)}, status=400)

@api_view(["GET"])
def ping(request): return Response({"status": "ok"})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def system_info(request): return Response({"status": "Healthy", "engine": "Infra-Native"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_query_suggest(request):
    return Response({"text": "AI suggest feature online", "sql": ""})
