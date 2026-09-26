import re

from logbook_annotate.models import Clip, Event
from logbook_annotate.report import session_body
from logbook_annotate.vlm.prompt import parse_events

SESSION_ID = re.compile(r"^[\w.:-]{1,64}$")


def test_posted_body_matches_the_server_schema(tmp_path):
    clip = Clip(
        folder=tmp_path,
        video=tmp_path / "clip.avi",
        started_at="20260926T133000Z",
        session_id="pi-01-20260926T133000Z",
        device_id="pi-01",
        wallet="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        duration_s=61.2,
        width=320,
        height=240,
        fps=10,
        clip_hash="abc",
    )
    body = session_body(clip, [Event("pedestrian", 4.25, 0.91, "yolo")])
    assert set(body) == {"sessionId", "wallet", "deviceId", "durationSeconds", "events"}
    assert SESSION_ID.fullmatch(body["sessionId"])
    assert len(body["deviceId"]) <= 32
    assert 32 <= len(body["wallet"]) <= 44
    assert body["events"] == [{"type": "pedestrian", "t": 4.25, "confidence": 0.91}]


def test_parser_keeps_only_rare_event_types():
    text = '{"events": [{"type": "lane_change", "t": 2, "confidence": 0.8}, {"type": "pedestrian", "t": 1, "confidence": 0.9}]}'
    parsed = parse_events("sure\n" + text)
    assert [event.type for event in parsed] == ["lane_change"]
