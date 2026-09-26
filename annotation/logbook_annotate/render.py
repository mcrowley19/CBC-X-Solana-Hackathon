from __future__ import annotations

import subprocess
import threading
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageFont

from logbook_annotate.config import PACKAGE_ROOT
from logbook_annotate.ffmpeg import encoder_args
from logbook_annotate.models import Detection, Event, MotionEvent, TrackPoint

PAPER = (242, 236, 223, 255)
INK = (19, 35, 61, 255)
ACCENT = (200, 67, 30, 255)
CARD_HOLD_S = 2.5
CARD_FADE_S = 0.25

RARE = {"near_miss", "collision", "lane_change", "red_light", "hazard", "emergency_vehicle"}
NAMES = {
    "near_miss": "Near miss",
    "collision": "Collision",
    "lane_change": "Lane change",
    "red_light": "Red light",
    "hazard": "Hazard",
    "emergency_vehicle": "Emergency vehicle",
    "pedestrian": "Pedestrian",
    "cyclist": "Cyclist",
    "bicycle": "Bicycle",
    "stop_sign": "Stop sign",
    "traffic_light": "Traffic light",
    "car": "Car",
    "truck": "Truck",
    "bus": "Bus",
    "motorcycle": "Motorcycle",
    "hard_brake": "Hard brake",
    "hard_accel": "Hard acceleration",
    "swerve": "Swerve",
}
VULNERABLE = {"pedestrian", "bicycle", "cyclist"}


def render_review(
    video: Path,
    dest: Path,
    detections: list[Detection],
    events: list[Event],
    motion: list[MotionEvent],
    track: list[TrackPoint],
    fps: float,
    duration_s: float,
) -> None:
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise RuntimeError(f"Could not read {video}")
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if fps <= 0:
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 15)
    out_w = width + (width % 2)
    out_h = height + (height % 2)

    by_frame: dict[int, list[Detection]] = {}
    for detection in detections:
        by_frame.setdefault(detection.frame, []).append(detection)
    cards = _cards(events, motion)
    display, mono = _fonts(height)

    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{out_w}x{out_h}",
        "-r",
        f"{fps:.4f}",
        "-i",
        "-",
        "-an",
        *encoder_args(),
        "-pix_fmt",
        "yuv420p",
        str(dest),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdin is not None
    stderr_parts: list[bytes] = []

    def _drain() -> None:
        if proc.stderr is not None:
            stderr_parts.append(proc.stderr.read())

    drain = threading.Thread(target=_drain, daemon=True)
    drain.start()
    frame_index = 0
    code = -1
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            t = frame_index / fps
            image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
            if image.size != (out_w, out_h):
                canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 255))
                canvas.paste(image, (0, 0))
                image = canvas
            _draw_boxes(image, by_frame.get(frame_index, []), mono)
            _draw_bar(image, cards, duration_s)
            _draw_card(image, cards, t, display, mono)
            _draw_hud(image, t, _speed(track, t), mono)
            rgb = image.convert("RGB")
            proc.stdin.write(rgb.tobytes())
            frame_index += 1
        proc.stdin.close()
        code = proc.wait()
        drain.join()
    finally:
        capture.release()
        if proc.poll() is None:
            proc.kill()
            drain.join(timeout=2)
    stderr = b"".join(stderr_parts).decode("utf-8", "replace")
    if code != 0:
        tail = stderr.strip().splitlines()
        raise RuntimeError(tail[-1] if tail else "ffmpeg failed while writing the review video")


def _cards(events: list[Event], motion: list[MotionEvent]) -> list[tuple[float, str, str]]:
    cards = [(event.t, event.type, f"{event.confidence:.2f}") for event in events if event.type in RARE]
    cards.extend((item.t, item.kind, f"{item.g:.2f} g") for item in motion)
    cards.sort(key=lambda item: item[0])
    return cards


def _fonts(height: int) -> tuple[ImageFont.ImageFont, ImageFont.ImageFont]:
    fonts = PACKAGE_ROOT / "assets" / "fonts"
    display_size = max(18, height // 16)
    mono_size = max(12, height // 28)
    display_path = fonts / "Fraunces.ttf"
    mono_path = fonts / "JetBrainsMono-Medium.ttf"
    try:
        return (
            ImageFont.truetype(str(display_path), display_size),
            ImageFont.truetype(str(mono_path), mono_size),
        )
    except OSError:
        fallback = ImageFont.load_default()
        return fallback, fallback


def _draw_boxes(image: Image.Image, detections: list[Detection], font: ImageFont.ImageFont) -> None:
    draw = ImageDraw.Draw(image)
    for detection in detections:
        color = ACCENT if detection.category in VULNERABLE else INK
        box = [detection.x1, detection.y1, detection.x2, detection.y2]
        draw.rectangle(box, outline=color, width=2)
        label = f"{NAMES.get(detection.category, detection.category)} {detection.track_id}"
        left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
        tw, th = right - left, bottom - top
        x = max(0, detection.x1)
        y = max(0, detection.y1 - th - 6)
        draw.rectangle([x, y, x + tw + 8, y + th + 4], fill=PAPER)
        draw.text((x + 4, y + 1), label, fill=INK, font=font)


def _draw_bar(image: Image.Image, cards: list[tuple[float, str, str]], duration_s: float) -> None:
    if duration_s <= 0:
        return
    width, height = image.size
    bar_h = max(18, height // 18)
    top = height - bar_h
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, top, width, height], fill=PAPER)
    draw.line([0, top, width, top], fill=INK, width=1)
    pad = 12
    for t, _kind, _detail in cards:
        x = pad + (width - 2 * pad) * min(1.0, max(0.0, t / duration_s))
        draw.line([x, top + 4, x, height - 4], fill=ACCENT, width=2)


def _draw_card(
    image: Image.Image,
    cards: list[tuple[float, str, str]],
    t: float,
    display: ImageFont.ImageFont,
    mono: ImageFont.ImageFont,
) -> None:
    active = [(start, kind, detail) for start, kind, detail in cards if 0 <= t - start <= CARD_HOLD_S + CARD_FADE_S]
    if not active:
        return
    rare = [card for card in active if card[1] in RARE]
    start, kind, detail = (rare or active)[-1]
    age = t - start
    if age > CARD_HOLD_S:
        alpha = max(0.0, 1 - (age - CARD_HOLD_S) / CARD_FADE_S)
    else:
        alpha = 1.0
    if alpha <= 0:
        return

    title = NAMES.get(kind, kind)
    stamp = f"{_clock(start)}  ·  {detail}"
    draw_probe = ImageDraw.Draw(image)
    title_box = draw_probe.textbbox((0, 0), title, font=display)
    stamp_box = draw_probe.textbbox((0, 0), stamp, font=mono)
    tw = max(title_box[2] - title_box[0], stamp_box[2] - stamp_box[0])
    th = (title_box[3] - title_box[1]) + (stamp_box[3] - stamp_box[1]) + 18
    card_w, card_h = tw + 28, th + 8
    card = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rectangle([0, 0, card_w, card_h], fill=PAPER)
    cd.rectangle([0, 0, 4, card_h], fill=ACCENT)
    cd.text((14, 6), title, fill=INK, font=display)
    cd.text((14, 8 + (title_box[3] - title_box[1])), stamp, fill=(74, 86, 112, 255), font=mono)

    red, green, blue, channel = card.split()
    channel = channel.point(lambda px: int(px * alpha))
    card = Image.merge("RGBA", (red, green, blue, channel))
    _, height = image.size
    bar_h = max(18, height // 18)
    image.alpha_composite(card, (16, height - bar_h - card_h - 12))


def _draw_hud(image: Image.Image, t: float, speed_mps: float | None, font: ImageFont.ImageFont) -> None:
    speed = f"   {round(speed_mps * 3.6)} km/h" if speed_mps is not None else ""
    label = f"LOGBOOK   {_clock(t)}{speed}"
    draw = ImageDraw.Draw(image)
    left, top, right, bottom = draw.textbbox((0, 0), label, font=font)
    pad = 6
    draw.rectangle([12, 12, 12 + (right - left) + pad * 2, 12 + (bottom - top) + pad * 2], fill=PAPER)
    draw.text((12 + pad, 12 + pad), label, fill=INK, font=font)


def _speed(track: list[TrackPoint], t: float) -> float | None:
    chosen: TrackPoint | None = None
    for point in track:
        if point.t > t:
            break
        chosen = point
    if chosen is None or chosen.speed is None:
        return None
    return chosen.speed


def _clock(t: float) -> str:
    whole = max(0, int(t))
    return f"{whole // 60}:{whole % 60:02d}"
