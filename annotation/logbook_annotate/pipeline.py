from __future__ import annotations

import fcntl
import hashlib
import json
import logging
import os
import tempfile
from pathlib import Path

from logbook_annotate.config import Settings
from logbook_annotate.detect import YoloDetector
from logbook_annotate.events import WINDOW_S, events_from_tracks, finalize, place_window_events, window_starts
from logbook_annotate.ffmpeg import cut_window
from logbook_annotate.ingest import load_clip, sha256_file
from logbook_annotate.labels import build_labels
from logbook_annotate.models import Clip, ClipError, Event, MotionEvent
from logbook_annotate.motion import motion_events
from logbook_annotate.render import render_review
from logbook_annotate.report import post_session, session_body
from logbook_annotate.vlm import build_vlm

log = logging.getLogger("logbook")


def annotate(folder: Path, settings: Settings, detector=None, vlm=None) -> Path:
    clip = load_clip(folder, settings)
    out = settings.out_dir / clip.session_id
    lock = _lock_output(out)
    try:
        _reject_foreign_session(out, clip.clip_hash)
        _same_video(clip.video, clip.clip_hash)
        detector = detector or YoloDetector(settings.yolo_model, settings.yolo_device)
        vlm = vlm if vlm is not None else build_vlm(settings)

        log.info("detecting %s", clip.video.name)
        detections = detector.track(clip.video)
        motion = motion_events(clip.sensors)
        events = finalize(
            [*events_from_tracks(detections, clip.fps), *_vlm_events(clip, vlm)],
            motion,
            sensors_present=bool(clip.sensors),
            duration_s=clip.duration_s,
        )

        frame_count = int(clip.duration_s * clip.fps) + 1
        labels = build_labels(clip.video.name, detections, clip.fps, frame_count)
        body = session_body(clip, events)
        events_text = json.dumps(body, indent=2) + "\n"
        annotation_hash = hashlib.sha256(events_text.encode()).hexdigest()
        record = _clip_record(clip, body, motion, annotation_hash, complete=False)
        _atomic_write(out / "clip.json", json.dumps(record, indent=2) + "\n")
        _atomic_write(out / "labels.json", json.dumps(labels, indent=2) + "\n")
        _atomic_write(out / "events.json", events_text)

        log.info("rendering review video")
        review = out / "review.mp4"
        if review.exists():
            review.unlink()
        preview = out / "review.partial.mp4"
        rendered = False
        try:
            render_review(
                clip.video,
                preview,
                detections,
                events,
                motion,
                clip.track,
                clip.fps,
                clip.duration_s,
            )
            rendered = True
            os.replace(preview, review)
        finally:
            if preview.exists() and not rendered:
                preview.unlink()
        _same_video(clip.video, clip.clip_hash)
        record["complete"] = True
        _atomic_write(out / "clip.json", json.dumps(record, indent=2) + "\n")

        if settings.post:
            log.info("paying session %s", clip.session_id)
            receipt = post_session(body, settings, raw=events_text)
            _atomic_write(out / "receipt.json", json.dumps(receipt, indent=2) + "\n")
        return out
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()


def _lock_output(out: Path):
    out.mkdir(parents=True, exist_ok=True)
    handle = open(out / ".annotate-lock", "a+")
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as exc:
        handle.close()
        raise ClipError(f"{out.name} is already being annotated") from exc
    return handle


def _same_video(video: Path, clip_hash: str) -> None:
    if sha256_file(video) != clip_hash:
        raise ClipError("the video changed after it was checked")


def _atomic_write(path: Path, text: str) -> None:
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(text)
    os.replace(temporary, path)


def _reject_foreign_session(out: Path, clip_hash: str) -> None:
    record = out / "clip.json"
    if not record.is_file():
        return
    try:
        previous = json.loads(record.read_text())
    except json.JSONDecodeError as exc:
        raise ClipError(f"{out.name}/clip.json is unreadable; delete it before annotating again") from exc
    if previous.get("clipHash") != clip_hash:
        raise ClipError(f"{out.name} already belongs to a different clip")


def _vlm_events(clip: Clip, vlm) -> list[Event]:
    events: list[Event] = []
    starts = window_starts(clip.duration_s)
    if not starts:
        return events
    with tempfile.TemporaryDirectory(prefix="logbook-proxy-") as tmp:
        work = Path(tmp)
        for index, start in enumerate(starts):
            duration = min(WINDOW_S, max(0.1, clip.duration_s - start))
            if getattr(vlm, "needs_video", True):
                proxy = cut_window(clip.video, start, duration, work / f"window_{index:03d}.mp4")
            else:
                proxy = clip.video
            local = vlm.annotate_window(proxy, start, duration)
            events.extend(place_window_events(start, local, duration))
    return events


def _clip_record(clip: Clip, body: dict, motion: list[MotionEvent], annotation_hash: str, complete: bool) -> dict:
    return {
        "sessionId": clip.session_id,
        "video": str(clip.video),
        "clipHash": clip.clip_hash,
        "annotationHash": annotation_hash,
        "complete": complete,
        "durationSeconds": body["durationSeconds"],
        "events": body["events"],
        "motion": [{"t": item.t, "kind": item.kind, "g": item.g} for item in motion],
        "track": [
            {"t": point.t, "lat": point.lat, "lng": point.lng, "speed": point.speed} for point in clip.track
        ],
    }
