from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Callable
from pathlib import Path

from logbook_annotate.config import Settings

DONE = ".annotate-done"
FAILED = ".annotate-failed"
LOCAL = ".annotate-local"
RUNNING = ".annotate-running"

log = logging.getLogger("logbook")


def pending_clips(root: Path, *, posting: bool) -> list[Path]:
    if not root.is_dir():
        return []
    ready: list[Path] = []
    for folder in sorted(path for path in root.iterdir() if path.is_dir()):
        if folder.is_symlink():
            continue
        if (folder / DONE).exists() or (folder / FAILED).exists() or (folder / RUNNING).exists():
            continue
        if not posting and (folder / LOCAL).exists():
            continue
        meta = folder / "metadata.json"
        if not meta.is_file():
            continue
        try:
            parsed = json.loads(meta.read_text())
        except json.JSONDecodeError:
            (folder / FAILED).write_text("metadata.json is not valid JSON\n")
            log.error("%s: metadata.json is not valid JSON", folder.name)
            continue
        if isinstance(parsed, dict):
            ready.append(folder)
    return ready


def watch_loop(
    root: Path,
    settings: Settings,
    runner: Callable[[Path, Settings], Path],
    poll_s: float = 2.0,
    once: bool = False,
) -> int:
    failed = 0
    while True:
        for folder in pending_clips(root, posting=settings.post):
            if not _lock(folder):
                continue
            try:
                out = runner(folder, settings)
                if settings.post:
                    (folder / DONE).write_text(f"{out}\n")
                    local = folder / LOCAL
                    if local.exists():
                        local.unlink()
                else:
                    (folder / LOCAL).write_text(f"{out}\n")
                marker = folder / FAILED
                if marker.exists():
                    marker.unlink()
            except Exception as exc:
                failed += 1
                log.error("%s: %s", folder.name, exc)
                (folder / FAILED).write_text(f"{exc}\n")
            finally:
                running = folder / RUNNING
                if running.exists():
                    running.unlink()
        if once:
            return failed
        time.sleep(poll_s)


def _lock(folder: Path) -> bool:
    try:
        fd = os.open(folder / RUNNING, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    os.close(fd)
    return True
