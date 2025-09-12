Here’s a clean Raspberry Pi sender script that:
- Prompts the user which local file to send (in a loop).
- Uploads to your server 192.168.1.102:2121 as user wilo.
- Uses tqdm to show progress.
- Retries on transient errors.
- Lets you override server/credentials via flags if needed.

Save on the Pi as rpi_sender.py and run with python3 rpi_sender.py.

```python
#!/usr/bin/env python3
import argparse
import ftplib
import os
import sys
import time
from pathlib import Path
from datetime import datetime

try:
    from tqdm import tqdm  # pip install tqdm
except Exception:
    tqdm = None

DEFAULT_SERVER = "192.168.1.102"
DEFAULT_PORT = 2121
DEFAULT_USER = "wilo"
DEFAULT_PASS = "12345678"
DEFAULT_REMOTE_DIR = "/uploads"

RETRIES = 3
RETRY_SLEEP = 3  # seconds
CHUNK = 64 * 1024

def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def connect(server: str, port: int, user: str, password: str, passive: bool = True) -> ftplib.FTP:
    ftp = ftplib.FTP()
    ftp.connect(server, port, timeout=10)
    ftp.login(user, password)
    ftp.set_pasv(passive)
    return ftp

def upload_with_progress(ftp: ftplib.FTP, local_path: Path, remote_dir: str, remote_name: str | None) -> None:
    if not local_path.exists() or not local_path.is_file():
        raise FileNotFoundError(f"Local file not found: {local_path}")
    size = local_path.stat().st_size
    if size == 0:
        raise ValueError(f"Local file is empty: {local_path}")

    if remote_dir:
        ftp.cwd(remote_dir)
    target_name = remote_name or local_path.name

    # tqdm progress
    bar = None
    if tqdm is not None:
        bar = tqdm(total=size, unit="B", unit_scale=True, desc=target_name)

    def reader_gen(f):
        while True:
            data = f.read(CHUNK)
            if not data:
                break
            if bar:
                bar.update(len(data))
            yield data

    log(f"Uploading {local_path} -> {ftp.pwd().rstrip('/')}/{target_name}")
    with open(local_path, "rb") as f:
        # Use storbinary with a generator to update progress
        ftp.storbinary(f"STOR {target_name}", f if bar is None else reader_gen(f))

    if bar:
        bar.close()
    log("Upload complete")

def try_upload(server: str, port: int, user: str, password: str, local_path: Path, remote_dir: str, remote_name: str | None) -> bool:
    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            ftp = connect(server, port, user, password, passive=True)
            try:
                upload_with_progress(ftp, local_path, remote_dir, remote_name)
            finally:
                try:
                    ftp.quit()
                except Exception:
                    pass
            return True
        except ftplib.all_errors as e:
            last_err = e
            log(f"FTP error (attempt {attempt}/{RETRIES}): {e}")
        except Exception as e:
            last_err = e
            log(f"Error (attempt {attempt}/{RETRIES}): {e}")
        if attempt < RETRIES:
            time.sleep(RETRY_SLEEP)
    log(f"Failed to upload after {RETRIES} attempts. Last error: {last_err}")
    return False

def interactive_loop(server: str, port: int, user: str, password: str, remote_dir: str) -> None:
    log(f"Connected target: ftp://{user}@{server}:{port}{remote_dir or '/'} (passive mode)")
    log("Type a local file path to upload. Press Enter on an empty line to exit.")
    while True:
        try:
            path_str = input("Local file to send (empty to quit): ").strip()
        except EOFError:
            break
        if not path_str:
            break
        local_path = Path(path_str).expanduser()
        remote_name = input(f"Remote filename (Enter to keep '{local_path.name}'): ").strip() or None

        ok = try_upload(server, port, user, password, local_path, remote_dir, remote_name)
        if ok:
            log("Upload OK")
        else:
            log("Upload FAILED")

def main() -> int:
    ap = argparse.ArgumentParser(description="RPi FTP sender with prompt and tqdm progress")
    ap.add_argument("--server", default=DEFAULT_SERVER)
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--user", default=DEFAULT_USER)
    ap.add_argument("--password", default=DEFAULT_PASS)
    ap.add_argument("--remote-dir", default=DEFAULT_REMOTE_DIR, help="Remote directory (e.g., /uploads)")

    # Optional one-shot mode
    ap.add_argument("--file", help="Path of a local file to upload (skip prompt)")
    ap.add_argument("--name", help="Remote filename (default: same as local)")

    args = ap.parse_args()

    if args.file:
        ok = try_upload(args.server, args.port, args.user, args.password, Path(args.file), args.remote_dir, args.name)
        return 0 if ok else 1

    interactive_loop(args.server, args.port, args.user, args.password, args.remote_dir)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

How to use on the Pi
- Install tqdm (for progress bars):
  sudo apt-get update && sudo apt-get install -y python3-pip
  pip3 install tqdm

- Save as rpi_sender.py and run:
  python3 rpi_sender.py
  - Then type paths like ./myfile.txt when prompted.
  - It will upload to /uploads on 192.168.1.102:2121 as wilo.

- One-shot (no prompt):
  python3 rpi_sender.py --file ./myfile.txt
  python3 rpi_sender.py --file ./myfile.txt --name sensor_001.csv

If you want this to watch a folder and auto-send new files, say the word and I’ll extend it with a directory watcher.