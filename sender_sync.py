#!/usr/bin/env python3
import os
import sys
import time
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List

# Config
OUTBOX_DIR = Path(os.environ.get("OUTBOX_DIR", "outbox"))
SENT_DIR = Path(os.environ.get("SENT_DIR", "outbox_sent"))
FAILED_DIR = Path(os.environ.get("FAILED_DIR", "outbox_failed"))
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/uploads")
SCAN_INTERVAL_SEC = int(os.environ.get("SCAN_INTERVAL_SEC", "5"))
STABILITY_WAIT_SEC = int(os.environ.get("STABILITY_WAIT_SEC", "2"))
RETRIES = int(os.environ.get("RETRIES", "3"))

RPI_SCRIPT = Path("rpi.py")


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def ensure_dirs() -> None:
    for d in (OUTBOX_DIR, SENT_DIR, FAILED_DIR):
        d.mkdir(parents=True, exist_ok=True)


def list_outbox() -> List[Path]:
    return sorted([p for p in OUTBOX_DIR.glob("*.csv") if p.is_file()])


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


def process_once() -> None:
    files = list_outbox()
    if not files:
        return
    for f in files:
        if not is_stable(f, STABILITY_WAIT_SEC):
            log(f"Skipping (not stable yet): {f.name}")
            continue
        ok = False
        for attempt in range(1, RETRIES + 1):
            log(f"Attempt {attempt}/{RETRIES} uploading {f.name}")
            if upload_one(f):
                ok = True
                break
            time.sleep(2)
        if ok:
            dst = move_with_timestamp(f, SENT_DIR)
            log(f"Uploaded and archived to: {dst}")
        else:
            dst = move_with_timestamp(f, FAILED_DIR)
            log(f"Failed after retries; moved to: {dst}")


def main() -> int:
    log("Starting sender_sync (watching outbox for *.csv)")
    ensure_dirs()
    try:
        while True:
            process_once()
            time.sleep(SCAN_INTERVAL_SEC)
    except KeyboardInterrupt:
        log("Stopped by user")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
