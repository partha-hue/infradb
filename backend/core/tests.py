from django.test import TestCase

# Create your tests here.
import requests

API_URL = "https://api.cohere.ai/v1/generate"
API_KEY = "915CtyhNKt0GOom9UvRBcwLVqYATSiKo6NLnaVgn"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "xlarge",
    "prompt": "Write a SQL query to list top 5 products by sales",
    "max_tokens": 150
}

response = requests.post(API_URL, headers=headers, json=payload)
print(response.status_code, response.json())
