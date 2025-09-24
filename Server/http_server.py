#!/usr/bin/env python3
"""
Simple HTTP server to expose CSV files from the Data/ directory.

Endpoints:
- GET /files              -> JSON array of CSV files with metadata (sorted by newest first)
- GET /files/latest       -> JSON with the latest CSV file metadata
- GET /download/<name>    -> Download the specified CSV file

CORS: Permissive (Access-Control-Allow-Origin: *) for easy frontend integration.

Usage:
  python3 Server/http_server.py --host 0.0.0.0 --port 8000

Then from your frontend, you can:
  fetch("http://<server-ip>:8000/files").then(r => r.json())
  fetch("http://<server-ip>:8000/download/<filename>")

This server only uses Python's standard library (no external dependencies).
"""
import argparse
import json
import os
import re
import socket
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import unquote, urlparse

# Root project dir and the data folder
PROJECT_ROOT = "/home/vu-server/Desktop/Wilo-Cloud-Monitoring"
DATA_DIR = os.path.join(PROJECT_ROOT, "Data")

# Ensure Data dir exists
os.makedirs(DATA_DIR, exist_ok=True)

CSV_NAME_RE = re.compile(r"^[^/\\]+\.csv$")  # prevent path traversal; simple <name>.csv


def list_csv_files():
    """Return a list of dicts for CSV files in DATA_DIR, sorted by mtime desc."""
    entries = []
    try:
        for name in os.listdir(DATA_DIR):
            if not name.lower().endswith(".csv"):
                continue
            fpath = os.path.join(DATA_DIR, name)
            if not os.path.isfile(fpath):
                continue
            try:
                st = os.stat(fpath)
                entries.append({
                    "name": name,
                    "size_bytes": st.st_size,
                    "modified": datetime.fromtimestamp(st.st_mtime).isoformat(),
                })
            except OSError:
                continue
    except FileNotFoundError:
        pass
    # newest first
    entries.sort(key=lambda e: e["modified"], reverse=True)
    return entries


class CSVRequestHandler(BaseHTTPRequestHandler):
    server_version = "CSVServer/1.0"

    def _set_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):  # handle CORS preflight
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            path = parsed.path.rstrip("/") or "/"

            if path == "/":
                return self._handle_root()
            if path == "/files":
                return self._handle_files()
            if path == "/files/latest":
                return self._handle_latest()
            if path.startswith("/download/"):
                name = unquote(path[len("/download/"):])
                return self._handle_download(name)

            self._send_json({"error": "Not found"}, status=404)
        except Exception as e:
            self._send_json({"error": "Internal server error", "detail": str(e)}, status=500)

    def _handle_root(self):
        # Minimal HTML page for quick manual checks
        files = list_csv_files()
        html = [
            "<html><head><meta charset='utf-8'><title>CSV Server</title>",
            "<style>body{font-family:sans-serif;margin:2rem;} code{background:#f6f8fa;padding:2px 4px;border-radius:4px;}</style>",
            "</head><body>",
            "<h1>CSV Server</h1>",
            "<p>Endpoints:</p>",
            "<ul>",
            "<li><code>GET /files</code></li>",
            "<li><code>GET /files/latest</code></li>",
            "<li><code>GET /download/&lt;filename.csv&gt;</code></li>",
            "</ul>",
            f"<p>Data directory: <code>{DATA_DIR}</code></p>",
            "<h2>Latest files</h2>",
            "<ul>",
        ]
        for f in files[:10]:
            html.append(
                f"<li>{f['modified']} — {f['name']} ("\
                f"<a href='/download/{f['name']}'>download</a>)</li>"
            )
        html.extend(["</ul>", "</body></html>"])
        content = "".join(html).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self._set_cors()
        self.end_headers()
        self.wfile.write(content)

    def _handle_files(self):
        files = list_csv_files()
        self._send_json({"files": files})

    def _handle_latest(self):
        files = list_csv_files()
        if not files:
            self._send_json({"error": "No files"}, status=404)
            return
        self._send_json({"latest": files[0]})

    def _handle_download(self, name: str):
        # validate file name to avoid path traversal
        if not CSV_NAME_RE.match(name):
            self._send_json({"error": "Invalid file name"}, status=400)
            return
        fpath = os.path.join(DATA_DIR, name)
        if not os.path.isfile(fpath):
            self._send_json({"error": "File not found"}, status=404)
            return
        try:
            fs = os.stat(fpath)
            self.send_response(200)
            self.send_header("Content-Type", "text/csv")
            self.send_header("Content-Disposition", f"attachment; filename={name}")
            self.send_header("Content-Length", str(fs.st_size))
            self.send_header("Cache-Control", "no-store")
            self._set_cors()
            self.end_headers()
            with open(fpath, "rb") as f:
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except OSError as e:
            self._send_json({"error": "Error reading file", "detail": str(e)}, status=500)

    def _send_json(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self._set_cors()
        self.end_headers()
        self.wfile.write(data)


def get_local_ip():
    """Best-effort way to determine the local IP for display purposes."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(description="Serve CSV files from the Data directory")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    args = parser.parse_args()

    httpd = HTTPServer((args.host, args.port), CSVRequestHandler)
    ip = get_local_ip() if args.host == "0.0.0.0" else args.host
    print(f"Serving CSVs from {DATA_DIR}")
    print(f"HTTP server listening on http://{ip}:{args.port}")
    print("Endpoints: /files, /files/latest, /download/<filename>")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    # Ensure stdout is unbuffered for immediate logs when run via some process managers
    os.environ["PYTHONUNBUFFERED"] = "1"
    main()
