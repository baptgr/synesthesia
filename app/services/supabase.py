import os
from typing import Optional
from io import BytesIO

import requests
from supabase import Client, create_client


_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY/ANON_KEY must be set")

    _supabase_client = create_client(url, key)
    return _supabase_client


def generate_signed_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    client = get_supabase_client()
    resp = client.storage.from_(bucket).create_signed_url(path, expires_in)
    if not resp or "signedURL" not in resp:
        raise RuntimeError(f"Failed to create signed URL for {bucket}/{path}")
    # supabase-py returns dict with 'signedURL' or 'signed_url' depending on version
    return resp.get("signedURL") or resp.get("signed_url")


def get_public_url(bucket: str, path: str) -> str:
    client = get_supabase_client()
    resp = client.storage.from_(bucket).get_public_url(path)
    if not resp or "publicURL" not in resp:
        # Some versions return dict with 'public_url'
        return resp.get("public_url") if isinstance(resp, dict) else str(resp)
    return resp["publicURL"]


def upload_bytes(bucket: str, path: str, data: bytes, content_type: str = "application/octet-stream", upsert: bool = False) -> None:
    base_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set for uploads")
    url = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{path}"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "Content-Type": content_type,
        "x-upsert": "true" if upsert else "false",
    }
    r = requests.post(url, headers=headers, data=data, timeout=60)
    if not r.ok:
        raise RuntimeError(f"Upload failed: {r.status_code} {r.text}")
