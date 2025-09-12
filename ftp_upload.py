#!/usr/bin/env python3
"""
Simple FTP uploader for Wilo Cloud Monitoring

- Uploads backend/readings/aggregate_data.csv to ftp://172.168.4.50:2121/upload/aggregate_data.csv
- Fill in USERNAME and PASSWORD below before running

Usage:
  python3 ftp_upload.py

Optionally, you can override defaults with environment variables:
  FTP_HOST, FTP_PORT, FTP_USERNAME, FTP_PASSWORD, FTP_LOCAL_PATH, FTP_REMOTE_PATH
"""

import os
import sys
from ftplib import FTP, error_perm
from typing import List

# ======== Configuration (edit USERNAME and PASSWORD) ========
HOST = os.getenv("FTP_HOST", "172.168.4.50")
PORT = int(os.getenv("FTP_PORT", "2121"))
USERNAME = os.getenv("FTP_USERNAME", "user")  # <-- change me
PASSWORD = os.getenv("FTP_PASSWORD", "password")  # <-- change me

LOCAL_PATH = os.getenv(
    "FTP_LOCAL_PATH",
    os.path.join(os.path.dirname(__file__), "backend", "readings", "aggregate_data.csv"),
)
REMOTE_PATH = os.getenv("FTP_REMOTE_PATH", "/upload/aggregate_data.csv")
# ============================================================


def log(msg: str) -> None:
    print(msg, flush=True)


def _split_remote_dir_path(path: str) -> List[str]:
    # Normalize and split remote directory into parts, skipping empty parts
    norm = path.replace("\\", "/")
    parts = [p for p in norm.split("/") if p]
    return parts


def ensure_remote_dir(ftp: FTP, remote_dir: str) -> None:
    """Ensure the full remote directory exists (create if missing)."""
    if not remote_dir or remote_dir in ("/", "."):
        return

    # Remember starting directory
    start_cwd = ftp.pwd()
    try:
        # Work from root if path is absolute
        if remote_dir.startswith("/"):
            ftp.cwd("/")
            path_parts = _split_remote_dir_path(remote_dir)
        else:
            path_parts = _split_remote_dir_path(remote_dir)

        for part in path_parts:
            try:
                ftp.cwd(part)
            except error_perm:
                # Try to make it then cd
                ftp.mkd(part)
                ftp.cwd(part)
    finally:
        # Return to original directory to be explicit; upload step will cwd again
        try:
            ftp.cwd(start_cwd)
        except Exception:
            pass


def upload_file():
    if USERNAME == "YOUR_USERNAME" or PASSWORD == "YOUR_PASSWORD":
        log("ERROR: Please edit ftp_upload.py and set USERNAME and PASSWORD (or provide env vars).")
        sys.exit(1)

    if not os.path.isfile(LOCAL_PATH):
        log(f"ERROR: Local file not found: {LOCAL_PATH}")
        sys.exit(1)

    remote_dir, remote_name = os.path.split(REMOTE_PATH)
    if not remote_name:
        log(f"ERROR: Remote path must include a filename, got: {REMOTE_PATH}")
        sys.exit(1)

    log(f"Connecting to FTP {HOST}:{PORT} ...")
    with FTP() as ftp:
        ftp.connect(HOST, PORT, timeout=30)
        ftp.set_pasv(True)
        log("Logging in ...")
        ftp.login(USERNAME, PASSWORD)
        log(f"Logged in. Server CWD: {ftp.pwd()}")

        # Ensure remote directory exists and change into it
        if remote_dir:
            log(f"Ensuring remote directory exists: {remote_dir}")
            ensure_remote_dir(ftp, remote_dir)
            log(f"Changing to remote directory: {remote_dir}")
            # If absolute, start from root
            if remote_dir.startswith("/"):
                ftp.cwd("/")
            for part in _split_remote_dir_path(remote_dir):
                ftp.cwd(part)

        size_bytes = os.path.getsize(LOCAL_PATH)
        log(f"Uploading {LOCAL_PATH} -> {REMOTE_PATH} ({size_bytes} bytes) ...")

        sent = 0
        def _progress(chunk: bytes):
            nonlocal sent
            sent += len(chunk)
            # Print progress every ~1MB or on completion
            if sent == size_bytes or sent // (1024 * 1024) != (sent - len(chunk)) // (1024 * 1024):
                mb = sent / (1024 * 1024)
                total_mb = size_bytes / (1024 * 1024)
                log(f"  Progress: {mb:.1f} MB / {total_mb:.1f} MB")

        with open(LOCAL_PATH, "rb") as f:
            ftp.storbinary(f"STOR {remote_name}", f, blocksize=64 * 1024, callback=_progress)

        log("Upload complete.")


if __name__ == "__main__":
    try:
        upload_file()
    except Exception as e:
        log(f"ERROR: {e}")
        sys.exit(1)
