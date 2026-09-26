from __future__ import annotations

import hashlib
import json
import logging
import tempfile
from pathlib import Path

from logbook_annotate.config import Settings
from logbook_annotate.detect import YoloDetector
from logbook_annotate.events import WINDOW_S, events_from_tracks, finalize, place_window_events, window_starts
from logbook_annotate.ffmpeg import cut_window
from logbook_annotate.ingest import load_clip
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
    _reject_foreign_session(out, clip.clip_hash)
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

    out = settings.out_dir / clip.session_id
    _reject_foreign_session(out, clip.clip_hash)
    out.mkdir(parents=True, exist_ok=True)
    labels = build_labels(clip.video.name, detections, clip.fps)
    body = session_body(clip, events)
    (out / "labels.json").write_text(json.dumps(labels, indent=2) + "\n")
    events_path = out / "events.json"
    events_text = json.dumps(body, indent=2) + "\n"
    events_path.write_text(events_text)
    annotation_hash = hashlib.sha256(events_text.encode()).hexdigest()
    (out / "clip.json").write_text(
        json.dumps(_clip_record(clip, events, motion, annotation_hash), indent=2) + "\n"
    )

    log.info("rendering review video")
    render_review(
        clip.video,
        out / "review.mp4",
        detections,
        events,
        motion,
        clip.track,
        clip.fps,
        clip.duration_s,
    )

    if settings.post:
        log.info("paying session %s", clip.session_id)
        receipt = post_session(body, settings, raw=events_text)
        (out / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    return out


def _reject_foreign_session(out: Path, clip_hash: str) -> None:
    record = out / "clip.json"
    if not record.is_file():
        return
    try:
        previous = json.loads(record.read_text())
    except json.JSONDecodeError:
        return
    previous_hash = previous.get("clipHash")
    if previous_hash and previous_hash != clip_hash:
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


def _clip_record(clip: Clip, events: list[Event], motion: list[MotionEvent], annotation_hash: str) -> dict:
    return {
        "sessionId": clip.session_id,
        "video": str(clip.video),
        "clipHash": clip.clip_hash,
        "annotationHash": annotation_hash,
        "durationSeconds": round(clip.duration_s, 3),
        "events": [
            {"type": event.type, "t": event.t, "confidence": event.confidence, "source": event.source}
            for event in events
        ],
        "motion": [{"t": item.t, "kind": item.kind, "g": item.g} for item in motion],
        "track": [
            {"t": point.t, "lat": point.lat, "lng": point.lng, "speed": point.speed} for point in clip.track
        ],
    }
