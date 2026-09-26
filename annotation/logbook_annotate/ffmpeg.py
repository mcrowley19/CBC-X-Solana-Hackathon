from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


class FfmpegError(RuntimeError):
    pass


def run(cmd: list[str], timeout: float = 180) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise FfmpegError(f"timed out after {timeout:.0f}s") from exc
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "").strip().splitlines()
        detail = tail[-1] if tail else f"exit {result.returncode}"
        raise FfmpegError(detail)
    return result


def probe(video: Path) -> tuple[float, int, int, float]:
    """Return duration seconds, width, height, and fps."""
    try:
        raw = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=width,height,avg_frame_rate,duration",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(video),
        ]
        ).stdout
    except FfmpegError:
        raise
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise FfmpegError("ffprobe returned invalid JSON") from exc
    stream = next((s for s in data.get("streams", []) if s.get("width")), {})
    duration = _float(stream.get("duration")) or _float(data.get("format", {}).get("duration")) or 0.0
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    fps = _rate(stream.get("avg_frame_rate")) or 15.0
    return duration, width, height, fps


def cut_window(video: Path, start_s: float, duration_s: float, dest: Path) -> Path:
    """Write a 720p-or-smaller, 2 fps proxy of one window. The source file is left as-is."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start_s:.3f}",
            "-t",
            f"{duration_s:.3f}",
            "-i",
            str(video),
            "-an",
            "-vf",
            "fps=2,scale='min(1280,iw)':-2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "28",
            str(dest),
        ]
    )
    return dest


def encoder_args() -> list[str]:
    if sys.platform == "darwin":
        try:
            listed = run(["ffmpeg", "-hide_banner", "-encoders"]).stdout
        except FfmpegError:
            listed = ""
        if "h264_videotoolbox" in listed:
            return ["-c:v", "h264_videotoolbox", "-b:v", "8M"]
    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]


def _float(value: object) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0


def _rate(value: object) -> float:
    if not isinstance(value, str) or value in {"", "0/0"}:
        return 0.0
    if "/" in value:
        num, den = value.split("/", 1)
        denom = _float(den)
        return _float(num) / denom if denom else 0.0
    return _float(value)
