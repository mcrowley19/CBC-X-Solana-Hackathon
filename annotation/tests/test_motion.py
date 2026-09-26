from logbook_annotate.models import SensorSample
from logbook_annotate.motion import motion_events


def _sample(t: float, ax: float = 0, gz: float = 0) -> SensorSample:
    return SensorSample(t, ax, 0, 1, 0, 0, gz)


def test_horizontal_spike_and_yaw_become_motion_events():
    samples = [_sample(0), _sample(1, ax=0.6, gz=1.2), _sample(2)]
    events = motion_events(samples)
    kinds = {(event.kind, event.t) for event in events}
    assert ("hard_accel", 1) in kinds
    assert ("swerve", 1) in kinds


def test_a_spike_on_the_other_axis_still_counts():
    samples = [_sample(0, ax=0.1), _sample(1, ax=0.1), SensorSample(2, 0.1, -0.7, 1, 0, 0, 0)]
    events = motion_events(samples)
    assert [event.kind for event in events] == ["hard_brake"]


def test_repeated_spike_keeps_the_stronger_sample():
    samples = [_sample(0, ax=-0.4), _sample(1, ax=-0.8)]
    events = motion_events(samples)
    brakes = [event for event in events if event.kind == "hard_brake"]
    assert len(brakes) == 1
    assert brakes[0].g == 0.8
