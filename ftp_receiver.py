#!/usr/bin/env python3
import argparse
import ftplib
import os
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Callable, Tuple
from datetime import datetime

try:
    from tqdm import tqdm  # type: ignore
except Exception:  # pragma: no cover
    tqdm = None  # fallback printing will be used

STOP = False

def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

@dataclass
class Config:
    host: str
    port: int
    user: str
    password: str
    remote_dir: str
    local_dir: Path
    interval: float
    passive: bool
    delete_remote: bool
    once: bool
    max_retries: int
    retry_backoff: float


def connect(cfg: Config) -> ftplib.FTP:
    ftp = ftplib.FTP()
    ftp.connect(cfg.host, cfg.port, timeout=10)
    ftp.login(cfg.user, cfg.password)
    ftp.set_pasv(cfg.passive)
    return ftp


def ensure_dirs(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def get_remote_listing(ftp: ftplib.FTP, remote_dir: str) -> list[Tuple[str, Optional[int]]]:
    """Return list of (name, size) for files in remote_dir. Directories are skipped when detectable."""
    items: list[Tuple[str, Optional[int]]] = []
    try:
        # Prefer MLSD for structured listing
        for name, facts in ftp.mlsd(remote_dir):  # type: ignore[attr-defined]
            typ = facts.get("type")
            if typ and typ.lower() == "file":
                size = None
                try:
                    size = int(facts.get("size")) if facts.get("size") else None
                except Exception:
                    size = None
                items.append((name, size))
    except Exception:
        # Fallback to NLST + SIZE per file
        try:
            names = ftp.nlst(remote_dir)
            # Normalize names to just basename relative to remote_dir
            base = remote_dir.rstrip("/") + "/" if remote_dir not in ("", "/") else ""
            for n in names:
                name = n[len(base):] if base and n.startswith(base) else os.path.basename(n)
                if not name or name in (".", ".."):
                    continue
                # Heuristic: try SIZE; if fails, accept with unknown size
                rpath = f"{remote_dir.rstrip('/')}/{name}" if remote_dir not in ("", "/") else f"/{name}"
                size: Optional[int]
                try:
                    size = ftp.size(rpath)  # type: ignore[attr-defined]
                except Exception:
                    size = None
                items.append((name, size))
        except ftplib.error_perm as e:
            if str(e).startswith('550'):
                # Directory may be empty
                return []
            raise
    return items


def download_with_progress(ftp: ftplib.FTP, rdir: str, name: str, ldir: Path, size: Optional[int]) -> Path:
    remote_path = f"{rdir.rstrip('/')}/{name}" if rdir not in ("", "/") else f"/{name}"
    final_path = ldir / name
    part_path = ldir / (name + ".part")

    existing_size = part_path.stat().st_size if part_path.exists() else 0
    mode = "ab" if existing_size > 0 else "wb"

    bar = None
    if tqdm and size and size > 0:
        bar = tqdm(total=size, unit="B", unit_scale=True, desc=name, initial=existing_size)

    bytes_downloaded = existing_size

    def writer(chunk: bytes) -> None:
        nonlocal bytes_downloaded, bar
        f.write(chunk)
        bytes_downloaded += len(chunk)
        if bar:
            bar.update(len(chunk))

    with open(part_path, mode) as f:
        if existing_size > 0:
            try:
                ftp.sendcmd(f"REST {existing_size}")
            except Exception:
                # If REST unsupported, restart from beginning
                f.seek(0)
                f.truncate(0)
                bytes_downloaded = 0
                if bar:
                    bar.reset(total=size or 0)
        ftp.retrbinary(f"RETR {remote_path}", writer, blocksize=64 * 1024)

    if bar:
        bar.close()

    part_path.replace(final_path)
    return final_path


def sizes_match(local_path: Path, size: Optional[int]) -> bool:
    if size is None:
        return False
    try:
        return local_path.exists() and local_path.stat().st_size == size
    except Exception:
        return False


def process_once(cfg: Config) -> bool:
    """Returns True if any file was downloaded, False otherwise."""
    ensure_dirs(cfg.local_dir)

    attempt = 0
    while True:
        try:
            ftp = connect(cfg)
            break
        except ftplib.all_errors as e:
            attempt += 1
            if attempt > cfg.max_retries:
                log(f"ERROR: unable to connect after {cfg.max_retries} retries: {e}")
                return False
            log(f"Connect failed: {e}; retrying in {cfg.retry_backoff}s...")
            time.sleep(cfg.retry_backoff)

    try:
        # List files
        items = get_remote_listing(ftp, cfg.remote_dir)
        if not items:
            log("No files found on remote.")
            return False
        downloaded_any = False
        for name, rsize in items:
            # Skip if file already exists with same size
            local_final = cfg.local_dir / name
            if sizes_match(local_final, rsize):
                continue
            try:
                log(f"Downloading {name} ({rsize if rsize is not None else 'unknown'} bytes)...")
                out = download_with_progress(ftp, cfg.remote_dir, name, cfg.local_dir, rsize)
                downloaded_any = True
                log(f"Saved to {out}")
                if cfg.delete_remote:
                    # Attempt to delete
                    rpath = f"{cfg.remote_dir.rstrip('/')}/{name}" if cfg.remote_dir not in ("", "/") else f"/{name}"
                    try:
                        ftp.delete(rpath)
                        log(f"Deleted remote file {rpath}")
                    except ftplib.all_errors as e:
                        log(f"WARN: could not delete remote file {rpath}: {e}")
            except ftplib.all_errors as e:
                log(f"ERROR downloading {name}: {e}")
        return downloaded_any
    finally:
        try:
            ftp.quit()
        except Exception:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Continuous FTP receiver with tqdm progress bars")
    parser.add_argument("--host", default=os.environ.get("FTP_HOST", "172.168.4.50"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("FTP_PORT", "2121")))
    parser.add_argument("--user", default=os.environ.get("FTP_USER", "anonymous"))
    parser.add_argument("--password", default=os.environ.get("FTP_PASS", ""))
    parser.add_argument("--remote-dir", default=os.environ.get("FTP_REMOTE_DIR", "/uploads"))
    parser.add_argument("--local-dir", default=os.environ.get("FTP_LOCAL_DIR", "./received"))
    parser.add_argument("--interval", type=float, default=float(os.environ.get("FTP_INTERVAL", "5")), help="Seconds between checks (ignored with --once)")
    parser.add_argument("--active", action="store_true", help="Use active mode (default passive)")
    parser.add_argument("--delete-remote", action="store_true", help="Delete remote file after successful download")
    parser.add_argument("--once", action="store_true", help="Run a single pass and exit")
    parser.add_argument("--retries", type=int, default=int(os.environ.get("FTP_RETRIES", "3")))
    parser.add_argument("--backoff", type=float, default=float(os.environ.get("FTP_BACKOFF", "5")))

    args = parser.parse_args()

    cfg = Config(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        remote_dir=args.remote_dir,
        local_dir=Path(args.local_dir),
        interval=args.interval,
        passive=not args.active,
        delete_remote=args.delete_remote,
        once=args.once,
        max_retries=args.retries,
        retry_backoff=args.backoff,
    )

    def _sig_handler(signum, frame):
        global STOP
        STOP = True
        log(f"Signal {signum} received, shutting down soon...")

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)

    if cfg.once:
        process_once(cfg)
        return 0

    log(
        f"Starting FTP receiver: host={cfg.host}:{cfg.port} user={cfg.user} rdir={cfg.remote_dir} ldir={cfg.local_dir} passive={cfg.passive} interval={cfg.interval}s"
    )

    ensure_dirs(cfg.local_dir)

    while not STOP:
        try:
            _ = process_once(cfg)
        except Exception as e:
            log(f"Loop error: {e}")
        # Sleep between iterations
        for _ in range(int(cfg.interval * 10)):
            if STOP:
                break
            time.sleep(0.1)

    log("Receiver stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
