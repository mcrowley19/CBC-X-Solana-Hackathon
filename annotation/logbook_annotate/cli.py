from __future__ import annotations

import json
import logging
from pathlib import Path

import typer

from logbook_annotate.config import Settings
from logbook_annotate.ffmpeg import probe
from logbook_annotate.models import Detection, Event, MotionEvent, TrackPoint
from logbook_annotate.pipeline import annotate
from logbook_annotate.render import render_review
from logbook_annotate.report import post_session
from logbook_annotate.watch import watch_loop

app = typer.Typer(add_completion=False, no_args_is_help=True)


def _settings(no_post: bool, backend: str | None, out: Path | None) -> Settings:
    settings = Settings.from_env()
    if no_post:
        settings.post = False
    if backend:
        settings.vlm_backend = backend
    if out is not None:
        settings.out_dir = out
    return settings


@app.callback()
def _main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


@app.command("annotate")
def annotate_clip(
    clip: Path = typer.Argument(..., help="One Pi clip folder (the directory that contains metadata.json)", exists=True),
    out: Path | None = typer.Option(None, help="Where to write events, labels, and the review video"),
    no_post: bool = typer.Option(False, help="Write the files and skip the payout"),
    backend: str | None = typer.Option(None, help="auto, mlx, ollama, or stub"),
) -> None:
    """Annotate one clip and, unless --no-post, pay the driver."""
    result = annotate(clip, _settings(no_post, backend, out))
    typer.echo(result)


@app.command()
def watch(
    inbox: Path = typer.Argument(..., help="Directory of clip folders, usually device/data"),
    out: Path | None = typer.Option(None, help="Where to write annotation output"),
    no_post: bool = typer.Option(False, help="Write the files and skip the payout"),
    backend: str | None = typer.Option(None, help="auto, mlx, ollama, or stub"),
    once: bool = typer.Option(False, help="Process whatever is already finished, then exit"),
) -> None:
    """Annotate each new clip folder once metadata.json is in place."""
    settings = _settings(no_post, backend, out)
    failed = watch_loop(inbox, settings, annotate, once=once)
    if once and failed:
        raise typer.Exit(code=1)


@app.command("render")
def render_saved(
    outdir: Path = typer.Argument(..., help="An annotation output folder", exists=True),
) -> None:
    """Draw the review video again from labels.json and clip.json."""
    record = json.loads((outdir / "clip.json").read_text())
    labels = json.loads((outdir / "labels.json").read_text())
    video = Path(record["video"])
    _duration, _width, _height, fps = probe(video)
    detections: list[Detection] = []
    for frame in labels.get("frames", []):
        index = round(frame["timestamp"] / 1000 * fps)
        for obj in frame["objects"]:
            box = obj["box2d"]
            detections.append(
                Detection(
                    frame=index,
                    track_id=int(obj["id"]),
                    category=str(obj["category"]),
                    score=float(obj["score"]),
                    x1=float(box["x1"]),
                    y1=float(box["y1"]),
                    x2=float(box["x2"]),
                    y2=float(box["y2"]),
                )
            )
    events = [
        Event(type=item["type"], t=item["t"], confidence=item["confidence"], source=item.get("source", "yolo"))
        for item in record.get("events", [])
    ]
    motion = [MotionEvent(t=item["t"], kind=item["kind"], g=item["g"]) for item in record.get("motion", [])]
    track = [
        TrackPoint(t=point["t"], lat=point["lat"], lng=point["lng"], speed=point.get("speed"))
        for point in record.get("track", [])
    ]
    render_review(video, outdir / "review.mp4", detections, events, motion, track, fps, record["durationSeconds"])
    typer.echo(outdir / "review.mp4")


@app.command()
def post(
    outdir: Path = typer.Argument(..., help="An annotation output folder that contains events.json", exists=True),
) -> None:
    """Send an already-written events.json to the payout API."""
    raw = (outdir / "events.json").read_text()
    receipt = post_session(json.loads(raw), Settings.from_env(), raw=raw)
    (outdir / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    typer.echo(json.dumps(receipt, indent=2))
