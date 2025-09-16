#!/usr/bin/env python3
"""
Continuous SFTP sync from a Raspberry Pi (via Twingate) to local directory.

Configuration via environment variables:
  RPI_HOST            Hostname or IP of the RPi reachable over Twingate
  RPI_PORT            SSH port (default: 22)
  RPI_USER            SSH username (default: pi)
  SSH_KEY_PATH        Path to private key (preferred)
  SSH_KEY_PASSPHRASE  Passphrase for the private key (optional)
  SSH_PASSWORD        SSH password (if you use password auth)
  RPI_REMOTE_DIR      Remote directory to pull from (default: /home/pi/data)
  LOCAL_DIR           Local directory to sync to (default: ./received)
  FILE_SUFFIX         Optional filter, e.g. ".csv" to sync only matching files
  SYNC_INTERVAL_SEC   Seconds between sync cycles (default: 10)

Example run:
  export RPI_HOST="<rpi-host>"; export RPI_USER="willo";
  export SSH_KEY_PATH="/home/ubuntu/.ssh/id_rsa";  # or set SSH_PASSWORD
  export RPI_REMOTE_DIR="/path/on/rpi"; export LOCAL_DIR="/home/vu-server/Wilo-Cloud-Monitoring/received";
  python3 scripts/rpi_sync.py
"""
import os
import time
import stat
import traceback
from pathlib import Path
from typing import Optional

import paramiko


def _connect_sftp(host: str, port: int, username: str,
                  password: Optional[str] = None,
                  key_path: Optional[str] = None,
                  key_passphrase: Optional[str] = None,
                  timeout: int = 20):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    pkey = None
    if key_path:
        # Try RSA and Ed25519 keys
        try:
            pkey = paramiko.RSAKey.from_private_key_file(key_path, password=key_passphrase)
        except paramiko.SSHException:
            pkey = paramiko.Ed25519Key.from_private_key_file(key_path, password=key_passphrase)

    client.connect(
        hostname=host,
        port=port,
        username=username,
        password=password,
        pkey=pkey,
        timeout=timeout,
    )
    return client, client.open_sftp()


def _ensure_local_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def _should_download(local_path: Path, remote_size: int, remote_mtime: float) -> bool:
    if not local_path.exists():
        return True
    try:
        stat_local = local_path.stat()
        if stat_local.st_size != remote_size:
            return True
        # if remote is newer than local by > 1s, download
        if remote_mtime > stat_local.st_mtime + 1:
            return True
    except FileNotFoundError:
        return True
    return False


def _sync_dir_recursive(sftp: paramiko.SFTPClient, remote_dir: str, local_dir: Path,
                         suffix_filter: Optional[str] = None):
    _ensure_local_dir(local_dir)

    for entry in sftp.listdir_attr(remote_dir):
        name = entry.filename
        remote_path = f"{remote_dir.rstrip('/')}/{name}"
        if stat.S_ISDIR(entry.st_mode):
            _sync_dir_recursive(sftp, remote_path, local_dir / name, suffix_filter)
            continue

        if suffix_filter and not name.endswith(suffix_filter):
            continue

        dest_path = local_dir / name
        if _should_download(dest_path, entry.st_size, entry.st_mtime):
            print(f"[SYNC] {remote_path} -> {dest_path}")
            tmp_path = dest_path.with_suffix(dest_path.suffix + ".part")
            _ensure_local_dir(dest_path.parent)
            sftp.get(remote_path, str(tmp_path))
            tmp_path.replace(dest_path)


def continuous_sync():
    # Hardcoded defaults (can be overridden by environment variables if set)
    host = os.environ.get("RPI_HOST", "100.96.0.2")
    port = int(os.environ.get("RPI_PORT", "22"))
    user = os.environ.get("RPI_USER", "willo")
    remote_dir = os.environ.get("RPI_REMOTE_DIR", "/home/willo/Desktop/Wilo-Cloud-Monitoring/data")
    local_dir = Path(os.environ.get("LOCAL_DIR", "/home/vu-server/Wilo-Cloud-Monitoring/received")).resolve()
    suffix = os.environ.get("FILE_SUFFIX")  # e.g. ".csv"
    interval = int(os.environ.get("SYNC_INTERVAL_SEC", "10"))

    key_path = os.environ.get("SSH_KEY_PATH")
    key_passphrase = os.environ.get("SSH_KEY_PASSPHRASE")
    password = os.environ.get("SSH_PASSWORD", "12345678")

    print("--- RPi Continuous Sync ---")
    print(f"Host: {host}:{port} as {user}")
    print(f"Remote: {remote_dir}")
    print(f"Local : {local_dir}")
    print(f"Filter: {suffix or 'none'} | Interval: {interval}s")

    while True:
        start = time.time()
        try:
            client, sftp = _connect_sftp(host, port, user, password, key_path, key_passphrase)
            try:
                _sync_dir_recursive(sftp, remote_dir, local_dir, suffix)
            finally:
                sftp.close()
                client.close()
        except Exception as e:
            print("[ERROR] Sync attempt failed:", e)
            traceback.print_exc()
        elapsed = time.time() - start
        sleep_for = max(1, interval - int(elapsed))
        time.sleep(sleep_for)


if __name__ == "__main__":
    continuous_sync()
