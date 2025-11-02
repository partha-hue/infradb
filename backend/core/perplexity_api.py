import os
import requests
from dotenv import load_dotenv

load_dotenv()

PERPLEXITY_KEY = os.getenv("PERPLEXITY_API_KEY")
BASE_URL = "https://api.perplexity.ai/v1"

def get_ai_suggestion(prompt: str):
    headers = {
        "Authorization": f"Bearer {PERPLEXITY_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "prompt": prompt,
        "max_tokens": 300,   # adjust as needed
        "model": "text-davinci-003"  # Perplexity model
    }

    response = requests.post(f"{BASE_URL}/completion", json=data, headers=headers)
    if response.status_code == 200:
        resp_json = response.json()
        # Perplexity might return 'text' field for generated content
        return resp_json.get("text", "")
    else:
        raise Exception(f"AI request failed: {response.status_code}, {response.text}")
