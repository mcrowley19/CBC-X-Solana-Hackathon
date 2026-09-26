import re

from logbook_annotate.models import Clip, Event, TrackPoint
from logbook_annotate.report import MAX_TRACK_POINTS, session_body
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


def test_duration_is_truncated_so_it_cannot_cross_a_minute(tmp_path):
    clip = Clip(
        folder=tmp_path,
        video=tmp_path / "clip.avi",
        started_at="20260926T133000Z",
        session_id="pi-01-20260926T133000Z",
        device_id="pi-01",
        wallet="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        duration_s=59.9996,
        width=320,
        height=240,
        fps=10,
        clip_hash="abc",
    )
    assert session_body(clip, [])["durationSeconds"] == 59.999


def test_parser_keeps_only_rare_event_types():
    text = '{"events": [{"type": "lane_change", "t": 2, "confidence": 0.8}, {"type": "pedestrian", "t": 1, "confidence": 0.9}]}'
    parsed = parse_events("sure\n" + text)
    assert parsed is not None
    assert [event.type for event in parsed] == ["lane_change"]
    assert parse_events("I see events but this is not JSON") is None
    assert parse_events('{"events": [{"type": "nope"}]}') is None
    assert parse_events('{"events": "x"}') is None


def test_phone_track_is_posted_rounded_and_thinned(tmp_path):
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
        track=[TrackPoint(t=i * 0.5, lat=51.4545 + i * 0.0000123456, lng=-2.5879, speed=3.0) for i in range(2 * MAX_TRACK_POINTS)],
    )
    body = session_body(clip, [])
    track = body["track"]
    assert len(track) <= MAX_TRACK_POINTS
    assert track[0] == {"t": 0.0, "lat": 51.4545, "lng": -2.5879}
    assert all(set(point) == {"t", "lat", "lng"} for point in track)
    # Without a track the key is absent, so the server sees exactly what it used to.
    assert "track" not in session_body(Clip(**{**clip.__dict__, "track": []}), [])
