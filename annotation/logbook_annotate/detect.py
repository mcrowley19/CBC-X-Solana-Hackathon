from __future__ import annotations

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
                track_id = int(ids[index]) if ids is not None else -(frame_index * 1000 + index + 1)
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
        return detections
