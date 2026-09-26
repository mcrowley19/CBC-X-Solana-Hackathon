from __future__ import annotations

from collections import defaultdict

from logbook_annotate.models import Detection, Event, MotionEvent

# Mirrors src/lib/rewards.ts. Anything under min confidence earns nothing.
MIN_CONFIDENCE = 0.5
RARE_CONFIDENCE = 0.75
MIN_TRACK_S = 0.5
MERGE_WINDOW_S = 3.0
SPIKE_WINDOW_S = 2.0

PAYOUT_FROM_TRACKS = {"pedestrian", "cyclist", "stop_sign", "traffic_light"}
VLM_TYPES = {"near_miss", "collision", "lane_change", "red_light", "hazard", "emergency_vehicle"}
NEEDS_SPIKE = {"near_miss", "collision"}

WINDOW_S = 12.0
WINDOW_STEP_S = 10.0


def window_starts(duration_s: float, window_s: float = WINDOW_S, step_s: float = WINDOW_STEP_S) -> list[float]:
    if duration_s <= 0:
        return []
    starts: list[float] = []
    t = 0.0
    while t < duration_s:
        starts.append(round(t, 3))
        if t + window_s >= duration_s - 0.05:
            break
        t += step_s
    return starts


def place_window_events(
    window_start_s: float,
    local: list[Event],
    window_duration_s: float = WINDOW_S,
) -> list[Event]:
    placed: list[Event] = []
    for event in local:
        if event.t > window_duration_s + 0.5:
            continue
        placed.append(
            Event(
                type=event.type,
                t=round(window_start_s + event.t, 3),
                confidence=event.confidence,
                source="vlm",
            )
        )
    return placed


def events_from_tracks(detections: list[Detection], fps: float) -> list[Event]:
    if fps <= 0:
        return []
    by_track: dict[int, list[Detection]] = defaultdict(list)
    for detection in detections:
        by_track[detection.track_id].append(detection)

    bike_tracks: list[list[Detection]] = []
    others: list[tuple[str, list[Detection]]] = []
    for dets in by_track.values():
        category = _majority(dets)
        if category == "bicycle":
            bike_tracks.append(dets)
        else:
            others.append((category, dets))

    riders: list[list[Detection]] = []
    events: list[Event] = []
    for category, dets in others:
        if category == "pedestrian" and any(_rides_bicycle(dets, bike) for bike in bike_tracks):
            riders.append(dets)
            continue
        event = _track_event(dets, category, fps)
        if event is not None:
            events.append(event)
    claimed: set[int] = set()
    for bike in bike_tracks:
        overlapping = [index for index, rider in enumerate(riders) if _rides_bicycle(rider, bike)]
        fresh = [index for index in overlapping if index not in claimed]
        if fresh:
            best = max((riders[index] for index in fresh), key=len)
            event = _track_event(best, "cyclist", fps)
            if event is not None:
                events.append(event)
            claimed.update(fresh)
            continue
        if overlapping:
            continue
        event = _track_event(bike, "cyclist", fps)
        if event is not None:
            events.append(event)
    for index, rider in enumerate(riders):
        if index in claimed:
            continue
        event = _track_event(rider, "cyclist", fps)
        if event is not None:
            events.append(event)
    return events


def _track_event(dets: list[Detection], category: str, fps: float) -> Event | None:
    if category not in PAYOUT_FROM_TRACKS:
        return None
    frames = {d.frame for d in dets}
    if len(frames) / fps < MIN_TRACK_S:
        return None
    return Event(
        type=category,
        t=round(min(frames) / fps, 3),
        confidence=round(sum(d.score for d in dets) / len(dets), 4),
        source="yolo",
    )


def finalize(
    events: list[Event],
    motion: list[MotionEvent],
    sensors_present: bool,
    duration_s: float,
) -> list[Event]:
    eligible = [event for event in events if _keep(event, duration_s)]
    if sensors_present:
        spikes = [item.t for item in motion]
        eligible = [
            event
            for event in eligible
            if event.type not in NEEDS_SPIKE or any(abs(event.t - spike) <= SPIKE_WINDOW_S for spike in spikes)
        ]
    yolo = _merge([event for event in eligible if event.source != "vlm"], MERGE_WINDOW_S)
    vlm = _merge([event for event in eligible if event.source == "vlm"], WINDOW_S)
    return sorted([*yolo, *vlm], key=lambda event: event.t)


def _keep(event: Event, duration_s: float) -> bool:
    if event.t < 0 or event.t > duration_s + 0.5:
        return False
    if not 0 <= event.confidence <= 1:
        return False
    if event.confidence < MIN_CONFIDENCE:
        return False
    if event.type in NEEDS_SPIKE and event.confidence < RARE_CONFIDENCE:
        return False
    if event.source == "vlm" and event.type not in VLM_TYPES:
        return False
    return True


def _merge(events: list[Event], gap_s: float) -> list[Event]:
    kept: list[Event] = []
    for event in sorted(events, key=lambda item: (item.t, -item.confidence)):
        collapsed = False
        for index in range(len(kept) - 1, -1, -1):
            prev = kept[index]
            if prev.type != event.type:
                continue
            if event.t - prev.t <= gap_s:
                if event.confidence > prev.confidence:
                    kept[index] = event
                collapsed = True
            break
        if not collapsed:
            kept.append(event)
    return kept


def _majority(dets: list[Detection]) -> str:
    scores: dict[str, list[float]] = defaultdict(list)
    for detection in dets:
        scores[detection.category].append(detection.score)
    return max(scores, key=lambda category: (len(scores[category]), sum(scores[category]), category))


def _rides_bicycle(person: list[Detection], bicycles: list[Detection]) -> bool:
    if not person or not bicycles:
        return False
    bikes: dict[int, list[Detection]] = defaultdict(list)
    for bike in bicycles:
        bikes[bike.frame].append(bike)
    hits = 0
    for detection in person:
        if any(_overlaps(detection, bike) for bike in bikes.get(detection.frame, [])):
            hits += 1
    return hits / len(person) >= 0.3


def _overlaps(a: Detection, b: Detection) -> bool:
    if _iou(a, b) > 0.05:
        return True
    cx = (a.x1 + a.x2) / 2
    cy = (a.y1 + a.y2) / 2
    return b.x1 <= cx <= b.x2 and b.y1 <= cy <= b.y2


def _iou(a: Detection, b: Detection) -> float:
    ix1, iy1 = max(a.x1, b.x1), max(a.y1, b.y1)
    ix2, iy2 = min(a.x2, b.x2), min(a.y2, b.y2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    area_a = max(0.0, a.x2 - a.x1) * max(0.0, a.y2 - a.y1)
    area_b = max(0.0, b.x2 - b.x1) * max(0.0, b.y2 - b.y1)
    union = area_a + area_b - inter
    return inter / union if union else 0.0
