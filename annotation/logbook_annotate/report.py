from __future__ import annotations

import json
import math

import requests

from logbook_annotate.config import Settings
from logbook_annotate.ingest import SESSION_ID, is_pubkey
from logbook_annotate.models import Clip, Event


def session_body(clip: Clip, events: list[Event]) -> dict:
    """The only fields POST /api/sessions keeps. Extra keys are stripped server-side."""
    body: dict[str, object] = {
        "sessionId": clip.session_id,
        "wallet": clip.wallet,
        "deviceId": clip.device_id,
        "durationSeconds": math.floor(clip.duration_s * 1000) / 1000,
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
    session_id = parsed.get("sessionId")
    if not isinstance(session_id, str) or SESSION_ID.fullmatch(session_id) is None:
        raise RuntimeError("sessionId must be 1-64 characters of letters, numbers, '_', '.', ':', or '-'")
    device_id = parsed.get("deviceId")
    if device_id is not None and (not isinstance(device_id, str) or len(device_id) > 32):
        raise RuntimeError("deviceId must be at most 32 characters")
    wallet = parsed.get("wallet")
    if not isinstance(wallet, str) or not is_pubkey(wallet):
        raise RuntimeError("wallet is not a Solana address")
    duration = parsed.get("durationSeconds") or 0
    if isinstance(duration, (int, float)) and duration > 24 * 60 * 60:
        raise RuntimeError("durationSeconds cannot exceed 24 hours")
    events = parsed.get("events") or []
    if isinstance(events, list) and len(events) > 1000:
        raise RuntimeError("a session cannot report more than 1000 events")
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
