from logbook_annotate.events import events_from_tracks, finalize, place_window_events, window_starts
from logbook_annotate.models import Detection, Event, MotionEvent


def _box(frame: int, track: int, category: str, score: float = 0.9) -> Detection:
    return Detection(frame, track, category, score, 10, 10, 40, 80)


def test_person_track_becomes_one_pedestrian_event():
    dets = [_box(frame, 3, "pedestrian") for frame in range(8)]
    events = events_from_tracks(dets, fps=10)
    assert len(events) == 1
    assert events[0].type == "pedestrian"
    assert events[0].t == 0
    assert events[0].confidence == 0.9


def test_short_track_is_ignored():
    dets = [_box(frame, 1, "stop_sign") for frame in range(3)]
    assert events_from_tracks(dets, fps=10) == []


def test_person_on_a_bicycle_is_one_cyclist():
    person = [_box(frame, 1, "pedestrian") for frame in range(10)]
    bike = [Detection(frame, 2, "bicycle", 0.8, 8, 30, 50, 90) for frame in range(10)]
    events = events_from_tracks(person + bike, fps=10)
    assert [event.type for event in events] == ["cyclist"]


def test_a_gappy_track_does_not_get_paid_for_empty_time():
    dets = [_box(0, 1, "pedestrian"), _box(20, 1, "pedestrian")]
    assert events_from_tracks(dets, fps=10) == []


def test_vlm_repeats_inside_one_window_pay_once():
    events = [
        Event("near_miss", 1, 0.9, "vlm"),
        Event("near_miss", 11, 0.8, "vlm"),
        Event("near_miss", 20, 0.9, "vlm"),
    ]
    spikes = [MotionEvent(1, "hard_brake", 0.4), MotionEvent(11, "hard_brake", 0.4), MotionEvent(20, "hard_brake", 0.4)]
    merged = finalize(events, spikes, True, 30)
    assert [event.t for event in merged] == [1, 20]


def test_window_times_are_added_to_the_clip_clock():
    local = [Event("lane_change", 1.5, 0.8, "vlm")]
    placed = place_window_events(10, local)
    assert placed[0].t == 11.5
    assert window_starts(25) == [0.0, 10.0, 20.0]


def test_near_miss_needs_confidence_and_a_spike_when_sensors_exist():
    weak = Event("near_miss", 1, 0.6, "vlm")
    strong = Event("near_miss", 1, 0.9, "vlm")
    quiet = finalize([strong], [], sensors_present=True, duration_s=10)
    assert quiet == []
    paid = finalize([weak, strong], [MotionEvent(1.4, "hard_brake", 0.4)], sensors_present=True, duration_s=10)
    assert [event.type for event in paid] == ["near_miss"]
    assert paid[0].confidence == 0.9


def test_same_event_inside_three_seconds_is_paid_once():
    events = [
        Event("pedestrian", 1, 0.7, "yolo"),
        Event("pedestrian", 3, 0.95, "yolo"),
        Event("pedestrian", 8, 0.8, "yolo"),
    ]
    merged = finalize(events, [], sensors_present=False, duration_s=20)
    assert [(event.t, event.confidence) for event in merged] == [(3, 0.95), (8, 0.8)]
