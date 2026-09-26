import json

import pytest

from logbook_annotate.config import Settings
from logbook_annotate.models import ClipError, Detection, Event
from logbook_annotate.pipeline import annotate
from logbook_annotate.vlm.stub import StubVlm
from logbook_annotate.watch import pending_clips, watch_loop


def write_clip(folder, seconds: float):
    from importlib.util import module_from_spec, spec_from_file_location
    from pathlib import Path

    path = Path(__file__).with_name("conftest.py")
    spec = spec_from_file_location("clip_factory", path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.write_clip(folder, seconds=seconds)


class ScriptedDetector:
    def track(self, video):
        del video
        return [Detection(frame, 7, "pedestrian", 0.92, 20, 30, 70, 160) for frame in range(10)]


def test_pipeline_writes_review_and_payout_files(clip_dir, tmp_path):
    settings = Settings(
        out_dir=tmp_path / "out",
        post=False,
        driver_wallet="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        device_id="pi-01",
        vlm_backend="stub",
    )
    vlm = StubVlm([Event("lane_change", 1.0, 0.8, "vlm"), Event("near_miss", 1.0, 0.92, "vlm")])
    out = annotate(clip_dir, settings, detector=ScriptedDetector(), vlm=vlm)

    events = json.loads((out / "events.json").read_text())
    kinds = {event["type"] for event in events["events"]}
    assert "pedestrian" in kinds
    assert "lane_change" in kinds
    assert "near_miss" in kinds
    clip = json.loads((out / "clip.json").read_text())
    assert clip["clipHash"]
    assert any(item["kind"] == "hard_accel" for item in clip["motion"])
    labels = json.loads((out / "labels.json").read_text())
    assert labels["frames"][0]["objects"][0]["category"] == "pedestrian"
    assert (out / "review.mp4").stat().st_size > 1000


def test_watch_runs_a_finished_folder_once(clip_dir, tmp_path):
    seen = []

    def runner(folder, settings):
        del settings
        seen.append(folder.name)
        return tmp_path / "out"

    watch_loop(clip_dir.parent, Settings(), runner, once=True)
    assert seen == [clip_dir.name]
    assert (clip_dir / ".annotate-done").exists()
    assert pending_clips(clip_dir.parent, posting=True) == []


def test_a_local_annotation_can_still_be_paid_later(clip_dir, tmp_path):
    def runner(folder, settings):
        del folder, settings
        return tmp_path / "out"

    watch_loop(clip_dir.parent, Settings(post=False), runner, once=True)
    assert (clip_dir / ".annotate-local").exists()
    assert not (clip_dir / ".annotate-done").exists()
    assert pending_clips(clip_dir.parent, posting=True) == [clip_dir]


def test_refuses_to_overwrite_a_different_clip(tmp_path):
    first = write_clip(tmp_path / "a" / "clip_20260926T133000Z", seconds=2)
    second = write_clip(tmp_path / "b" / "clip_20260926T133000Z", seconds=3)
    settings = Settings(
        out_dir=tmp_path / "out",
        post=False,
        driver_wallet="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        device_id="pi-01",
        vlm_backend="stub",
    )
    annotate(first, settings, detector=ScriptedDetector(), vlm=StubVlm())
    with pytest.raises(ClipError, match="different clip"):
        annotate(second, settings, detector=ScriptedDetector(), vlm=StubVlm())
