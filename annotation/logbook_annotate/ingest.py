from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from logbook_annotate.config import Settings
from logbook_annotate.ffmpeg import probe
from logbook_annotate.models import Clip, ClipError, SensorSample, TrackPoint

SESSION_ID = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_clip(folder: Path, settings: Settings) -> Clip:
    folder = folder.resolve()
    if not folder.is_dir():
        raise ClipError(f"{folder} is not a clip folder")

    meta_path = folder / "metadata.json"
    if meta_path.is_symlink():
        raise ClipError("metadata.json is a symlink")
    if meta_path.is_file() and meta_path.stat().st_nlink > 1:
        raise ClipError("metadata.json is a hard link")
    if not meta_path.is_file():
        raise ClipError(f"{folder.name} has no metadata.json")
    try:
        meta = json.loads(meta_path.read_text())
    except json.JSONDecodeError as exc:
        raise ClipError(f"{folder.name}/metadata.json is not valid JSON") from exc
    if not isinstance(meta, dict):
        raise ClipError("metadata.json must be an object")

    video = _video_path(folder, meta)
    if video.is_symlink():
        raise ClipError("the video file is a symlink")
    if not video.is_file():
        raise ClipError(f"Video file is missing: {video.name}")

    expected = str(meta.get("hash") or "")
    actual = sha256_file(video)
    if not expected:
        raise ClipError("metadata.json has no hash")
    if expected.lower() != actual.lower():
        raise ClipError("metadata hash does not match the video file")

    duration, width, height, fps = probe(video)
    if duration <= 0:
        raise ClipError("could not read the video duration")
    if width <= 0 or height <= 0:
        resolution = meta.get("resolution") or {}
        width = int(resolution.get("width") or width)
        height = int(resolution.get("height") or height)
    if fps <= 0:
        fps = float(meta.get("fps_target") or 15)

    started_at = str(meta.get("started_at") or _started_at_from_name(folder.name))
    device_id = str(meta.get("deviceId") or settings.device_id)
    wallet = _wallet(meta, settings)
    session_id = _session_id(device_id, started_at)

    return Clip(
        folder=folder,
        video=video,
        started_at=started_at,
        session_id=session_id,
        device_id=device_id,
        wallet=wallet,
        duration_s=duration,
        width=width,
        height=height,
        fps=fps,
        clip_hash=actual,
        sensors=_sensors(folder, meta, started_at),
        track=_track(folder),
    )


def _wallet(meta: dict, settings: Settings) -> str:
    raw = meta.get("wallet")
    meta_wallet = raw if isinstance(raw, str) else ""
    if meta_wallet and settings.driver_wallet and meta_wallet != settings.driver_wallet:
        raise ClipError("metadata wallet does not match DRIVER_WALLET")
    wallet = settings.driver_wallet or meta_wallet
    if wallet and not is_pubkey(wallet):
        raise ClipError("wallet is not a Solana address")
    return wallet


def _contained(folder: Path, name: str) -> Path:
    relative = Path(name)
    if relative.is_absolute() or ".." in relative.parts:
        raise ClipError(f"{name} escapes the clip folder")
    path = folder / relative
    if path.is_symlink():
        raise ClipError(f"{name} is a symlink")
    if path.is_file() and path.stat().st_nlink > 1:
        raise ClipError(f"{name} is a hard link")
    if not path.resolve().is_relative_to(folder.resolve()):
        raise ClipError(f"{name} escapes the clip folder")
    return path


def _video_path(folder: Path, meta: dict) -> Path:
    name = meta.get("filename")
    if isinstance(name, str) and name:
        return _contained(folder, name)
    matches = [path for path in [*folder.glob("*.avi"), *folder.glob("*.mp4")] if not path.is_symlink()]
    if len(matches) == 1:
        return _contained(folder, matches[0].name)
    raise ClipError("metadata.json needs a filename, or the folder needs exactly one video")


def _started_at_from_name(name: str) -> str:
    if name.startswith("clip_"):
        return name.removeprefix("clip_")
    return name


def is_pubkey(value: str) -> bool:
    """A Solana address is 32 bytes of base58. The server also requires it on the curve."""
    if not 32 <= len(value) <= 44 or any(char not in _B58 for char in value):
        return False
    number = 0
    for char in value:
        number = number * 58 + _B58.index(char)
    pad = len(value) - len(value.lstrip("1"))
    body = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return len(b"\x00" * pad + body) == 32


def _session_id(device_id: str, started_at: str) -> str:
    session_id = f"{device_id}-{started_at}"
    if not SESSION_ID.fullmatch(session_id):
        raise ClipError(
            f"sessionId {session_id!r} must be 1-64 characters of letters, numbers, '_', '.', ':', or '-'"
        )
    if len(device_id) > 32:
        raise ClipError("deviceId must be at most 32 characters")
    return session_id


def _parse_time(value: str) -> datetime:
    for fmt in ("%Y%m%dT%H%M%SZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    text = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _sensors(folder: Path, meta: dict, started_at: str) -> list[SensorSample]:
    name = str(meta.get("sensor_data_file") or "sensor_data.json")
    path = _contained(folder, name)
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ClipError(f"{path.name} is not valid JSON") from exc
    if not isinstance(raw, list):
        raise ClipError(f"{path.name} must be a list of samples")

    start = _parse_time(started_at)
    samples: list[SensorSample] = []
    for item in raw:
        if not isinstance(item, dict) or "timestamp" not in item:
            continue
        accel = item.get("accel_g") or {}
        gyro = item.get("gyro_rad_s") or {}
        try:
            stamp = _parse_time(str(item["timestamp"]))
        except ValueError as exc:
            raise ClipError(f"sensor timestamp is not a time: {item.get('timestamp')}") from exc
        t = (stamp - start).total_seconds()
        if t < 0:
            continue
        samples.append(
            SensorSample(
                t=t,
                ax=float(accel.get("x") or 0),
                ay=float(accel.get("y") or 0),
                az=float(accel.get("z") or 0),
                gx=float(gyro.get("x") or 0),
                gy=float(gyro.get("y") or 0),
                gz=float(gyro.get("z") or 0),
            )
        )
    if raw and not samples:
        raise ClipError(f"{path.name} has no sensor samples")
    samples.sort(key=lambda sample: sample.t)
    return samples


def _track(folder: Path) -> list[TrackPoint]:
    path = _contained(folder, "track.json")
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ClipError("track.json is not valid JSON") from exc
    if not isinstance(raw, list):
        raise ClipError("track.json must be a list")
    points: list[TrackPoint] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        if "lat" not in item or "lng" not in item:
            raise ClipError("each track point needs lat and lng")
        speed = item.get("speed")
        points.append(
            TrackPoint(
                t=float(item.get("t") or 0),
                lat=float(item["lat"]),
                lng=float(item["lng"]),
                speed=float(speed) if speed is not None else None,
            )
        )
    points.sort(key=lambda point: point.t)
    return points
