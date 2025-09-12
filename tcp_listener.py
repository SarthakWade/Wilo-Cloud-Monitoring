#!/usr/bin/env python3
"""
A simple multi-client TCP listener for port 2121 (configurable) to receive raw data.

- Binds to 0.0.0.0 by default
- Accepts multiple clients concurrently (thread-per-connection)
- Writes each connection's data to a new file under ./received/
- Logs connects/disconnects and byte counts
- Safe to run behind systemd; exits cleanly on SIGINT/SIGTERM

Usage:
  ./tcp_listener.py --port 2121 --host 0.0.0.0 --outdir ./received

Notes:
- This is a raw TCP server. It is NOT an FTP server. Use this to validate link and
  receive raw stream/file transmissions when the peer just pushes bytes.
- If you need FTP/FTPS, use the lftp-based helper: ftp_transfer.py
"""

import argparse
import os
import signal
import socket
import threading
import time
from datetime import datetime
from pathlib import Path

shutdown_flag = threading.Event()


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def handle_client(conn: socket.socket, addr, outdir: Path, bufsize: int) -> None:
    ip, port = addr
    start_ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = outdir / f"conn_{ip.replace(':', '_')}_{port}_{start_ts}.bin"
    total = 0
    log(f"Client connected: {ip}:{port} -> writing to {filename}")

    try:
        with conn, open(filename, "wb") as f:
            while not shutdown_flag.is_set():
                data = conn.recv(bufsize)
                if not data:
                    break
                f.write(data)
                total += len(data)
    except Exception as e:
        log(f"Error on {ip}:{port}: {e}")
    finally:
        log(f"Client disconnected: {ip}:{port}, bytes_received={total}")


def serve(host: str, port: int, outdir: Path, bufsize: int, backlog: int) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((host, port))
        s.listen(backlog)
        log(f"Listening on {host}:{port}, writing to {outdir}")
        s.settimeout(1.0)
        try:
            while not shutdown_flag.is_set():
                try:
                    conn, addr = s.accept()
                except socket.timeout:
                    continue
                t = threading.Thread(target=handle_client, args=(conn, addr, outdir, bufsize), daemon=True)
                t.start()
        finally:
            log("Server shutting down")


def main() -> int:
    parser = argparse.ArgumentParser(description="Simple TCP listener")
    parser.add_argument("--host", default="0.0.0.0", help="Bind address (default 0.0.0.0)")
    parser.add_argument("--port", type=int, default=2121, help="Listen port (default 2121)")
    parser.add_argument("--outdir", default="./received", help="Directory to store received files")
    parser.add_argument("--bufsize", type=int, default=65536, help="Read buffer size")
    parser.add_argument("--backlog", type=int, default=50, help="Listen backlog")
    args = parser.parse_args()

    def _signal_handler(signum, frame):
        log(f"Signal {signum} received, shutting down...")
        shutdown_flag.set()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    try:
        serve(args.host, args.port, Path(args.outdir), args.bufsize, args.backlog)
        return 0
    except PermissionError:
        log("Permission denied binding to port. Try a higher port or run with appropriate privileges.")
        return 13
    except OSError as e:
        log(f"OS error: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
