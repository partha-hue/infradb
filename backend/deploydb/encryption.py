import json
from cryptography.fernet import Fernet
from django.conf import settings

FERNET_KEY = getattr(settings, "FERNET_KEY", None)
if not FERNET_KEY:
    # development fallback (do NOT use in prod)
    FERNET_KEY = Fernet.generate_key().decode()

FERNET = Fernet(FERNET_KEY.encode())

def encrypt_obj(obj: dict) -> str:
    raw = json.dumps(obj).encode()
    return FERNET.encrypt(raw).decode()

def decrypt_obj(token: str) -> dict:
    raw = FERNET.decrypt(token.encode())
    return json.loads(raw.decode())
