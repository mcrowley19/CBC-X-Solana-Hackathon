from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from logbook_annotate.models import Detection

# COCO ids that matter for a forward dashcam. Cars are labeled for the dataset
# and the review video; only people, bikes, signs, and lights become payout events.
COCO_CATEGORY = {
    0: "pedestrian",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
    9: "traffic_light",
    11: "stop_sign",
}


class YoloDetector:
    def __init__(self, model_name: str = "yolo11n.pt", device: str = ""):
        self.model_name = model_name
        self.device = device

    def track(self, video: Path) -> list[Detection]:
        from ultralytics import YOLO

        model = YOLO(self.model_name)
        kwargs: dict[str, object] = {
            "source": str(video),
            "stream": True,
            "persist": True,
            "tracker": "bytetrack.yaml",
            "verbose": False,
            "classes": list(COCO_CATEGORY),
        }
        kwargs["device"] = self.device or "cpu"
        detections: list[Detection] = []
        for frame_index, result in enumerate(model.track(**kwargs)):
            boxes = result.boxes
            if boxes is None or boxes.xyxy is None:
                continue
            ids = boxes.id
            for index, xyxy in enumerate(boxes.xyxy.tolist()):
                cls_id = int(boxes.cls[index])
                category = COCO_CATEGORY.get(cls_id)
                if category is None:
                    continue
                track_id = int(ids[index]) if ids is not None else -1
                x1, y1, x2, y2 = xyxy
                detections.append(
                    Detection(
                        frame=frame_index,
                        track_id=track_id,
                        category=category,
                        score=float(boxes.conf[index]),
                        x1=float(x1),
                        y1=float(y1),
                        x2=float(x2),
                        y2=float(y2),
                    )
                )
        return link_untracked(detections)


def link_untracked(detections: list[Detection]) -> list[Detection]:
    """Give boxes that arrived without a tracker id one id per object across frames."""
    if not any(detection.track_id < 0 for detection in detections):
        return detections
    frames: dict[int, list[Detection]] = defaultdict(list)
    for detection in detections:
        frames[detection.frame].append(detection)
    next_id = -1
    previous: list[Detection] = []
    linked: list[Detection] = []
    for frame in sorted(frames):
        used: set[int] = set()
        current: list[Detection] = []
        for detection in frames[frame]:
            if detection.track_id >= 0:
                current.append(detection)
                continue
            best_index = -1
            best_score = 0.3
            for index, prior in enumerate(previous):
                if index in used or prior.track_id >= 0 or prior.frame != frame - 1:
                    continue
                if prior.category != detection.category:
                    continue
                score = _iou(prior, detection)
                if score >= best_score:
                    best_score = score
                    best_index = index
            if best_index >= 0:
                track_id = previous[best_index].track_id
                used.add(best_index)
            else:
                track_id = next_id
                next_id -= 1
            current.append(
                Detection(
                    detection.frame,
                    track_id,
                    detection.category,
                    detection.score,
                    detection.x1,
                    detection.y1,
                    detection.x2,
                    detection.y2,
                )
            )
        linked.extend(current)
        previous = current
    return linked


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
