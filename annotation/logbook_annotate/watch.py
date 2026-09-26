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


def pending_clips(root: Path, *, posting: bool) -> tuple[list[Path], int]:
    if not root.is_dir():
        return [], 0
    ready: list[Path] = []
    failed = 0
    for folder in sorted(path for path in root.iterdir() if path.is_dir()):
        if folder.is_symlink():
            continue
        if (folder / DONE).exists() or (folder / FAILED).exists():
            continue
        running = folder / RUNNING
        if running.exists() and _owner_alive(running):
            continue
        if running.exists():
            running.unlink()
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
            failed += 1
            continue
        if not isinstance(parsed, dict):
            (folder / FAILED).write_text("metadata.json must be an object\n")
            log.error("%s: metadata.json must be an object", folder.name)
            failed += 1
            continue
        ready.append(folder)
    return ready, failed


def watch_loop(
    root: Path,
    settings: Settings,
    runner: Callable[[Path, Settings], Path],
    poll_s: float = 2.0,
    once: bool = False,
) -> int:
    failed = 0
    while True:
        folders, failed_metadata = pending_clips(root, posting=settings.post)
        failed += failed_metadata
        for folder in folders:
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
                if "already being annotated" in str(exc):
                    log.info("%s: %s", folder.name, exc)
                    continue
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
    path = folder / RUNNING
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        if _owner_alive(path):
            return False
        path.unlink(missing_ok=True)
        try:
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            return False
    try:
        os.write(fd, f"{os.getpid()}\n".encode())
    finally:
        os.close(fd)
    return True


def _owner_alive(path: Path) -> bool:
    try:
        pid = int(path.read_text().strip() or "0")
    except (OSError, ValueError):
        return False
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True
