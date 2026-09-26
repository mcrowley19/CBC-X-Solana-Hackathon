from __future__ import annotations

import base64
from pathlib import Path

import cv2
import requests

from logbook_annotate.models import Event
from logbook_annotate.vlm.prompt import build_prompt, parse_events

DEFAULT_MODEL = "qwen3-vl:4b"


class OllamaVlm:
    """Sends a handful of frames from the window to a local Ollama vision model."""

    needs_video = True

    def __init__(self, model: str = "", host: str = "http://127.0.0.1:11434"):
        self.model = model or DEFAULT_MODEL
        self.host = host.rstrip("/")

    def annotate_window(self, video: Path, window_start_s: float, window_duration_s: float) -> list[Event]:
        del window_start_s
        frames = _sample_frames(video, 8)
        payload = {
            "model": self.model,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0},
            "messages": [
                {
                    "role": "user",
                    "content": build_prompt(window_duration_s)
                    + "\nThe attached frames are in order and evenly spaced across the window.",
                    "images": frames,
                }
            ],
        }
        try:
            response = requests.post(f"{self.host}/api/chat", json=payload, timeout=180)
        except requests.RequestException as exc:
            raise RuntimeError(f"Ollama is not reachable at {self.host}: {exc}") from exc
        if response.status_code >= 400:
            raise RuntimeError(f"Ollama returned {response.status_code}: {response.text[:300]}")
        try:
            content = response.json().get("message", {}).get("content", "")
        except ValueError as exc:
            raise RuntimeError(f"Ollama returned a non-JSON body: {response.text[:300]}") from exc
        events = parse_events(content)
        if events is None:
            raise RuntimeError("Ollama did not return an events JSON object")
        return events


def _sample_frames(video: Path, count: int) -> list[str]:
    capture = cv2.VideoCapture(str(video))
    try:
        if not capture.isOpened():
            raise RuntimeError(f"Could not read proxy video {video}")
        total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        indexes = {min(total - 1, round(i * (total - 1) / max(count - 1, 1))) for i in range(count)}
        encoded: list[str] = []
        frame_index = 0
        while frame_index < total + 2:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index in indexes:
                ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if ok:
                    encoded.append(base64.b64encode(buf.tobytes()).decode("ascii"))
            frame_index += 1
    finally:
        capture.release()
    if not encoded:
        raise RuntimeError(f"Proxy video {video.name} has no frames")
    return encoded
