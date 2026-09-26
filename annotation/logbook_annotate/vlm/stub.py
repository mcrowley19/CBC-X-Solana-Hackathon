from __future__ import annotations

from pathlib import Path

from logbook_annotate.models import Event


class StubVlm:
    """Returns scripted window-relative events. Used for development and tests."""

    needs_video = False

    def __init__(self, scripted: list[Event] | None = None):
        self.scripted = scripted or []

    def annotate_window(self, video: Path, window_start_s: float, window_duration_s: float) -> list[Event]:
        del video, window_start_s, window_duration_s
        return list(self.scripted)
