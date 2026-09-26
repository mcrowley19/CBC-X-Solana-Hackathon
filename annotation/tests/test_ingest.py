import json

import pytest

from logbook_annotate.config import Settings
from logbook_annotate.ingest import load_clip
from logbook_annotate.models import ClipError


def test_loads_pi_folder_and_converts_sensor_time(clip_dir):
    clip = load_clip(clip_dir, Settings(driver_wallet="walletwalletwalletwalletwalletwallet", device_id="pi-01"))
    assert clip.session_id == "pi-01-20260926T133000Z"
    assert clip.width == 320
    assert clip.fps == pytest.approx(10, abs=0.1)
    assert clip.duration_s == pytest.approx(2, abs=0.2)
    assert clip.sensors[1].t == pytest.approx(1, abs=0.05)
    assert clip.sensors[1].ax == pytest.approx(0.6)


def test_rejects_a_path_that_leaves_the_clip_folder(clip_dir):
    meta_path = clip_dir / "metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["filename"] = "../secret.avi"
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(ClipError, match="escapes"):
        load_clip(clip_dir, Settings(driver_wallet="walletwalletwalletwalletwalletwallet"))


def test_rejects_a_wallet_that_is_not_the_drivers(clip_dir):
    meta_path = clip_dir / "metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["wallet"] = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(ClipError, match="wallet"):
        load_clip(clip_dir, Settings(driver_wallet="So11111111111111111111111111111111111111112"))


def test_sensor_clock_starts_at_the_first_sample(clip_dir):
    started = "2026-09-26T13:30:05+00:00"
    samples = [
        {"timestamp": started, "accel_g": {"x": 0, "y": 0, "z": 1}, "gyro_rad_s": {"x": 0, "y": 0, "z": 0}},
        {"timestamp": "2026-09-26T13:30:06+00:00", "accel_g": {"x": 0.6, "y": 0, "z": 1}, "gyro_rad_s": {"x": 0, "y": 0, "z": 0}},
    ]
    (clip_dir / "sensor_data.json").write_text(json.dumps(samples))
    clip = load_clip(clip_dir, Settings(driver_wallet="walletwalletwalletwalletwalletwallet"))
    assert clip.sensors[0].t == 0
    assert clip.sensors[1].t == pytest.approx(1)


def test_rejects_a_hash_mismatch(clip_dir):
    meta_path = clip_dir / "metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["hash"] = "0" * 64
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(ClipError, match="hash"):
        load_clip(clip_dir, Settings())
