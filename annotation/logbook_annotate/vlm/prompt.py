from __future__ import annotations

import json
import re

from logbook_annotate.events import VLM_TYPES
from logbook_annotate.models import Event

PROMPT = """You are labeling one short window of a forward-facing dashcam.
This window is {duration:.1f} seconds long. t is seconds from the start of THIS window.
Report only events you can actually see. Omit anything you are guessing about.
Allowed types: near_miss, collision, lane_change, red_light, hazard, emergency_vehicle.
Use near_miss or collision only when it is unmistakable, with confidence at least 0.75. Otherwise omit them.
confidence is from 0 to 1. Use 0.9 when the event is obvious and 0.6 when it is probable.
Return JSON only, with t measured inside this window:
{{"events": [{{"type": "lane_change", "t": 1.5, "confidence": 0.8}}]}}
If nothing qualifies, return {{"events": []}}.
"""


def build_prompt(window_duration_s: float) -> str:
    return PROMPT.format(duration=max(window_duration_s, 0.1))


def parse_events(text: str) -> list[Event] | None:
    """Return events, or None when the model did not return an events array."""
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    raw = payload.get("events") if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return None

    events: list[Event] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        kind = str(item.get("type") or "")
        if kind not in VLM_TYPES:
            continue
        try:
            t = float(item.get("t"))
            confidence = float(item.get("confidence"))
        except (TypeError, ValueError):
            continue
        confidence = min(1.0, confidence)
        if confidence < 0 or t < 0:
            continue
        events.append(Event(type=kind, t=t, confidence=confidence, source="vlm"))
    if raw and not events:
        return None
    return events
