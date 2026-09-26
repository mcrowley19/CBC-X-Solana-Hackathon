from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from logbook_annotate.models import Event
from logbook_annotate.vlm.prompt import build_prompt, parse_events

DEFAULT_MODEL = "mlx-community/Qwen3-VL-8B-Instruct-4bit"


class MlxVlm:
    """Qwen3-VL through mlx-vlm. This runs on the Mac; the Framework cannot load MLX."""

    needs_video = True

    def __init__(self, model: str = ""):
        self.model = model or DEFAULT_MODEL

    def annotate_window(self, video: Path, window_start_s: float, window_duration_s: float) -> list[Event]:
        del window_start_s
        prompt = build_prompt(window_duration_s)
        cmd = [
            sys.executable,
            "-m",
            "mlx_vlm.generate",
            "--model",
            self.model,
            "--video",
            str(video),
            "--fps",
            "2",
            "--max-tokens",
            "400",
            "--temperature",
            "0",
            "--prompt",
            prompt,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("mlx-vlm timed out after 600s") from exc
        except OSError as exc:
            raise RuntimeError(
                "Could not run mlx-vlm. On the Mac install it with: uv sync --extra mlx"
            ) from exc
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip().splitlines()
            tail = detail[-1] if detail else f"exit {result.returncode}"
            if "No module named" in (result.stderr or ""):
                raise RuntimeError("mlx-vlm is not installed. On the Mac run: uv sync --extra mlx")
            raise RuntimeError(f"mlx-vlm failed: {tail}")
        events = parse_events(result.stdout)
        if events is None:
            raise RuntimeError(f"vision model did not return an events JSON object for {video.name}")
        return events
