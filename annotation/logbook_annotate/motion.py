from __future__ import annotations

from logbook_annotate.models import MotionEvent, SensorSample

# The Pi is assumed flat, Z up. X/Y are the dash plane, so a brake shows up
# as a horizontal spike rather than a change in the 1g the sensor always reads.
LONGITUDINAL_G = 0.3
YAW_RAD_S = 0.8


def motion_events(samples: list[SensorSample]) -> list[MotionEvent]:
    if not samples:
        return []

    found: list[MotionEvent] = []
    for sample in samples:
        along = sample.ax if abs(sample.ax) >= abs(sample.ay) else sample.ay
        if abs(along) >= LONGITUDINAL_G:
            found.append(
                MotionEvent(
                    t=sample.t,
                    kind="hard_accel" if along > 0 else "hard_brake",
                    g=round(abs(along), 3),
                )
            )
        yaw = abs(sample.gz)
        if yaw >= YAW_RAD_S:
            found.append(MotionEvent(t=sample.t, kind="swerve", g=round(yaw, 3)))
    return _collapse(found)


def _collapse(events: list[MotionEvent]) -> list[MotionEvent]:
    """Keep the strongest sample when the same kind repeats within 1.5 seconds."""
    kept: list[MotionEvent] = []
    for event in events:
        if kept and kept[-1].kind == event.kind and event.t - kept[-1].t <= 1.5:
            if event.g > kept[-1].g:
                kept[-1] = event
            continue
        kept.append(event)
    return kept
