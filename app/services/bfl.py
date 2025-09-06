import os
import time
from typing import Optional, Tuple

import requests


class BFLClient:
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.bfl.ai/v1") -> None:
        self.api_key = api_key or os.environ.get("BFL_API_KEY")
        if not self.api_key:
            raise RuntimeError("BFL_API_KEY must be set")
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "x-key": self.api_key,
            "accept": "application/json",
            "Content-Type": "application/json",
        })

    def submit_generation(self, prompt: str, model_endpoint: str = "/flux-dev") -> Tuple[str, str]:
        url = f"{self.base_url}{model_endpoint}"
        payload = {
            "prompt": prompt,
            "aspect_ratio": "1:1",
        }
        resp = self.session.post(url, json=payload, timeout=30)
        if not resp.ok:
            raise RuntimeError(f"BFL submit failed: {resp.status_code} {resp.text}")
        data = resp.json()
        request_id = data.get("id")
        polling_url = data.get("polling_url")
        if not request_id or not polling_url:
            raise RuntimeError("BFL submit response missing id or polling_url")
        return request_id, polling_url

    def poll_result_url(self, polling_url: str, timeout_seconds: int = 75, interval_seconds: float = 0.7) -> str:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            resp = self.session.get(polling_url, timeout=30)
            if not resp.ok:
                raise RuntimeError(f"BFL poll failed: {resp.status_code} {resp.text}")
            data = resp.json()
            status = data.get("status")
            if status == "Ready":
                result = data.get("result") or {}
                sample_url = result.get("sample")
                if not sample_url:
                    raise RuntimeError("BFL result missing sample url")
                return sample_url
            if status in {"Error", "Failed"}:
                raise RuntimeError(f"BFL generation failed: {data}")
            time.sleep(interval_seconds)
        raise TimeoutError("Timed out waiting for BFL result")

    def download_image_bytes(self, url: str) -> bytes:
        # delivery URLs may not have CORS; backend downloads and re-uploads
        r = self.session.get(url, timeout=60)
        if not r.ok:
            raise RuntimeError(f"Failed to download image: {r.status_code}")
        return r.content
