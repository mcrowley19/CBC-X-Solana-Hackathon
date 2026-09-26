from __future__ import annotations

import json

import requests

from logbook_annotate.config import Settings
from logbook_annotate.models import Clip, Event


def session_body(clip: Clip, events: list[Event]) -> dict:
    """The only fields POST /api/sessions keeps. Extra keys are stripped server-side."""
    body: dict[str, object] = {
        "sessionId": clip.session_id,
        "wallet": clip.wallet,
        "deviceId": clip.device_id,
        "durationSeconds": round(clip.duration_s, 3),
        "events": [
            {"type": event.type, "t": round(event.t, 3), "confidence": round(event.confidence, 4)}
            for event in events
        ],
    }
    return body


def post_session(body: dict, settings: Settings, raw: str | None = None) -> dict:
    payload = raw if raw is not None else json.dumps(body)
    parsed = json.loads(payload)
    if not settings.device_api_key:
        raise RuntimeError("DEVICE_API_KEY is not set")
    if not parsed.get("wallet"):
        raise RuntimeError("DRIVER_WALLET is not set, and the clip has no wallet")
    url = settings.logbook_host.rstrip("/") + "/api/sessions"
    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {settings.device_api_key}", "Content-Type": "application/json"},
            data=payload.encode(),
            timeout=60,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Could not reach {url}: {exc}") from exc
    try:
        payload = response.json()
    except ValueError:
        payload = {"error": response.text[:300]}
    if response.status_code >= 400:
        message = payload.get("error") if isinstance(payload, dict) else payload
        raise RuntimeError(f"Payout failed ({response.status_code}): {message}")
    return payload
