from __future__ import annotations

from logbook_annotate.models import Detection


def build_labels(
    video_name: str,
    detections: list[Detection],
    fps: float,
    frame_count: int | None = None,
) -> dict:
    grouped: dict[int, list[Detection]] = {}
    for detection in detections:
        if detection.frame < 0:
            continue
        if frame_count is not None and detection.frame >= frame_count:
            continue
        grouped.setdefault(detection.frame, []).append(detection)
    frames = []
    for frame, objects in sorted(grouped.items()):
        frames.append(
            {
                "timestamp": round(frame / fps * 1000),
                "objects": [
                    {
                        "id": obj.track_id,
                        "category": obj.category,
                        "box2d": {
                            "x1": round(obj.x1, 1),
                            "y1": round(obj.y1, 1),
                            "x2": round(obj.x2, 1),
                            "y2": round(obj.y2, 1),
                        },
                        "score": round(obj.score, 4),
                    }
                    for obj in objects
                ],
            }
        )
    return {"name": video_name, "frames": frames}
