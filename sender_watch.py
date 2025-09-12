#!/usr/bin/env python3
import os
import sys
import time
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Set

# Config
OUTBOX_DIR = Path(os.environ.get("OUTBOX_DIR", "outbox"))
SENT_DIR = Path(os.environ.get("SENT_DIR", "outbox_sent"))
FAILED_DIR = Path(os.environ.get("FAILED_DIR", "outbox_failed"))
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/uploads")
STABILITY_WAIT_SEC = int(os.environ.get("STABILITY_WAIT_SEC", "2"))
RETRIES = int(os.environ.get("RETRIES", "3"))
PATTERN_EXT = os.environ.get("PATTERN_EXT", ".csv")  # monitor only files ending with this

RPI_SCRIPT = Path("rpi.py")


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def ensure_dirs() -> None:
    for d in (OUTBOX_DIR, SENT_DIR, FAILED_DIR):
        d.mkdir(parents=True, exist_ok=True)


def is_stable(path: Path, wait_sec: int) -> bool:
    try:
        size1 = path.stat().st_size
        time.sleep(wait_sec)
        size2 = path.stat().st_size
        return size1 == size2 and size2 > 0
    except FileNotFoundError:
        return False


def upload_one(path: Path) -> bool:
    if not RPI_SCRIPT.exists():
        log("ERROR: rpi.py not found next to this script.")
        return False
    cmd = [sys.executable, str(RPI_SCRIPT), "put", str(path), REMOTE_DIR]
    log(f"Uploading {path.name} -> {REMOTE_DIR} via rpi.py")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
        stdout = (proc.stdout or "").strip()
        stderr = (proc.stderr or "").strip()
        if stdout:
            for line in stdout.splitlines():
                log(f"rpi.py: {line}")
        if stderr:
            for line in stderr.splitlines():
                log(f"rpi.py[err]: {line}")
        return proc.returncode == 0
    except Exception as e:
        log(f"Exception running rpi.py: {e}")
        return False


def move_with_timestamp(src: Path, dst_dir: Path) -> Path:
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = dst_dir / f"{src.stem}.{ts}{src.suffix}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return dst


# Optional dependency: watchdog for real-time events
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    HAVE_WATCHDOG = True
except Exception:
    HAVE_WATCHDOG = False


class CsvCreatedHandler(FileSystemEventHandler):
    def __init__(self) -> None:
        super().__init__()
        self.processing: Set[Path] = set()
        self.last_sizes: Dict[Path, int] = {}

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if not path.name.endswith(PATTERN_EXT):
            return
        self._handle(path)

    # Some writers create then modify/close; handle modify as well
    def on_modified(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if not path.name.endswith(PATTERN_EXT):
            return
        # debounce: only if growing
        try:
            size = path.stat().st_size
        except FileNotFoundError:
            return
        if self.last_sizes.get(path) != size:
            self.last_sizes[path] = size
            # attempt processing in case it's now stable
            self._handle(path)

    def _handle(self, path: Path) -> None:
        if path in self.processing:
            return
        self.processing.add(path)
        try:
            # wait until stable
            if not is_stable(path, STABILITY_WAIT_SEC):
                # schedule a delayed retry
                time.sleep(STABILITY_WAIT_SEC)
                if not is_stable(path, STABILITY_WAIT_SEC):
                    log(f"File not stable yet, skipping for now: {path.name}")
                    return
            ok = False
            for attempt in range(1, RETRIES + 1):
                log(f"Attempt {attempt}/{RETRIES} uploading {path.name}")
                if upload_one(path):
                    ok = True
                    break
                time.sleep(2)
            if ok:
                dst = move_with_timestamp(path, SENT_DIR)
                log(f"Uploaded and archived to: {dst}")
            else:
                dst = move_with_timestamp(path, FAILED_DIR)
                log(f"Failed after retries; moved to: {dst}")
        finally:
            if path in self.processing:
                self.processing.remove(path)


def run_watchdog() -> int:
    handler = CsvCreatedHandler()
    observer = Observer()
    observer.schedule(handler, str(OUTBOX_DIR), recursive=False)
    observer.start()
    log(f"Watching {OUTBOX_DIR} for *{PATTERN_EXT} (watchdog)")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Stopped by user")
    finally:
        observer.stop()
        observer.join()
    return 0


def run_polling() -> int:
    log("watchdog not available; falling back to polling. Install with: pip install watchdog")
    seen: Dict[Path, float] = {}
    try:
        while True:
            for path in OUTBOX_DIR.glob(f"*{PATTERN_EXT}"):
                if not path.is_file():
                    continue
                mtime = path.stat().st_mtime
                # process if new or updated
                if seen.get(path) == mtime:
                    continue
                seen[path] = mtime
                # handle like in watchdog handler
                if not is_stable(path, STABILITY_WAIT_SEC):
                    time.sleep(STABILITY_WAIT_SEC)
                    if not is_stable(path, STABILITY_WAIT_SEC):
                        log(f"File not stable yet, skipping: {path.name}")
                        continue
                ok = False
                for attempt in range(1, RETRIES + 1):
                    log(f"Attempt {attempt}/{RETRIES} uploading {path.name}")
                    if upload_one(path):
                        ok = True
                        break
                    time.sleep(2)
                if ok:
                    dst = move_with_timestamp(path, SENT_DIR)
                    log(f"Uploaded and archived to: {dst}")
                else:
                    dst = move_with_timestamp(path, FAILED_DIR)
                    log(f"Failed after retries; moved to: {dst}")
            time.sleep(1)
    except KeyboardInterrupt:
        log("Stopped by user")
        return 0


def main() -> int:
    ensure_dirs()
    if HAVE_WATCHDOG:
        return run_watchdog()
    else:
        return run_polling()


if __name__ == "__main__":
    raise SystemExit(main())
