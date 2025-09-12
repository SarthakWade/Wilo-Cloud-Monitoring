#!/usr/bin/env python3
"""
TCP CSV Listener (Ubuntu-friendly)

- Listens on a TCP port and appends any received text data to a CSV file.
- Intended to be paired with a sender that streams CSV over raw TCP.

Defaults (override via environment variables):
  LISTEN_HOST=0.0.0.0
  LISTEN_PORT=2121
  CSV_SAVE_PATH=received_data.csv

Usage:
  python3 tcp_csv_listener.py

Systemd service example (optional):
  Create /etc/systemd/system/tcp-csv-listener.service with:
    [Unit]
    Description=TCP CSV Listener
    After=network.target

    [Service]
    ExecStart=/usr/bin/env python3 /path/to/tcp_csv_listener.py
    WorkingDirectory=/path/to
    Restart=always
    Environment=LISTEN_PORT=2121 CSV_SAVE_PATH=/var/log/wilo/received_data.csv

    [Install]
    WantedBy=multi-user.target

  Then:
    sudo systemctl daemon-reload
    sudo systemctl enable --now tcp-csv-listener
"""

import os
import socket
import threading
from datetime import datetime

LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LISTEN_PORT", "2121"))
CSV_SAVE_PATH = os.getenv("CSV_SAVE_PATH", "received_data.csv")

print(f"[INFO] Listening on {LISTEN_HOST}:{LISTEN_PORT}")
print(f"[INFO] Appending to {CSV_SAVE_PATH}")

lock = threading.Lock()

def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def handle_client(conn: socket.socket, addr) -> None:
    log(f"Connection from {addr}")
    # Stream data and append as text (UTF-8, ignore bad bytes)
    with conn:
        with lock:
            # Ensure directory exists for CSV_SAVE_PATH
            dirname = os.path.dirname(os.path.abspath(CSV_SAVE_PATH))
            if dirname and not os.path.exists(dirname):
                os.makedirs(dirname, exist_ok=True)
        with open(CSV_SAVE_PATH, "a", encoding="utf-8", errors="ignore") as f:
            while True:
                data = conn.recv(64 * 1024)
                if not data:
                    break
                f.write(data.decode("utf-8", errors="ignore"))
        log(f"Data appended to {CSV_SAVE_PATH}")


def main() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # Allow quick restart
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((LISTEN_HOST, LISTEN_PORT))
        s.listen(50)
        log("Server ready. Waiting for connections...")
        while True:
            conn, addr = s.accept()
            t = threading.Thread(target=handle_client, args=(conn, addr), daemon=True)
            t.start()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Shutting down (Ctrl+C)")
