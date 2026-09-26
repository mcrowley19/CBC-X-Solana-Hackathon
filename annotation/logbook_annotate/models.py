from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


class ClipError(Exception):
    """The clip folder cannot be annotated."""


@dataclass(frozen=True)
class SensorSample:
    t: float
    ax: float
    ay: float
    az: float
    gx: float
    gy: float
    gz: float


@dataclass(frozen=True)
class TrackPoint:
    t: float
    lat: float
    lng: float
    speed: float | None = None


@dataclass(frozen=True)
class Detection:
    frame: int
    track_id: int
    category: str
    score: float
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class Event:
    type: str
    t: float
    confidence: float
    source: str = "yolo"


@dataclass(frozen=True)
class MotionEvent:
    t: float
    kind: str
    g: float


@dataclass
class Clip:
    folder: Path
    video: Path
    started_at: str
    session_id: str
    device_id: str
    wallet: str
    duration_s: float
    width: int
    height: int
    fps: float
    clip_hash: str
    sensors: list[SensorSample] = field(default_factory=list)
    track: list[TrackPoint] = field(default_factory=list)
