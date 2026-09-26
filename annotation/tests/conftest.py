from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


def write_clip(folder: Path, *, seconds: float = 2, spike: bool = False) -> Path:
    folder.mkdir(parents=True)
    video = folder / f"{folder.name}.avi"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=320x240:rate=10",
            "-t",
            str(seconds),
            "-c:v",
            "mjpeg",
            "-q:v",
            "8",
            str(video),
        ],
        check=True,
    )
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    started = datetime(2026, 9, 26, 13, 30, tzinfo=timezone.utc)
    started_at = started.strftime("%Y%m%dT%H%M%SZ")
    samples = []
    for index in range(int(seconds) + 1):
        ax = 0.6 if spike and index == 1 else 0.0
        samples.append(
            {
                "timestamp": (started + timedelta(seconds=index)).isoformat(),
                "orientation_deg": {"pitch": 0, "roll": 0, "yaw": 0},
                "accel_g": {"x": ax, "y": 0, "z": 1},
                "gyro_rad_s": {"x": 0, "y": 0, "z": 1.2 if spike and index == 1 else 0},
                "temperature_c": 20.0,
            }
        )
    (folder / "sensor_data.json").write_text(json.dumps(samples))
    (folder / "metadata.json").write_text(
        json.dumps(
            {
                "filename": video.name,
                "hash": digest,
                "started_at": started_at,
                "duration_s": seconds,
                "frame_count": int(seconds * 10),
                "resolution": {"width": 320, "height": 240},
                "fps_target": 10,
                "sensor_interval_s": 1,
                "sensor_sample_count": len(samples),
                "sensor_data_file": "sensor_data.json",
            }
        )
    )
    return folder


@pytest.fixture
def clip_dir(tmp_path: Path) -> Path:
    return write_clip(tmp_path / "clip_20260926T133000Z", spike=True)
