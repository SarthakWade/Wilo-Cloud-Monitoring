#!/usr/bin/env python3
"""
Minimal FTP server for Ubuntu using pyftpdlib.

- Serves files over FTP on a chosen host/port (default 0.0.0.0:2121)
- Creates a single user with full permissions in a specified home directory
- Great for quickly receiving uploads to a folder like /upload

Requirements:
  pip install pyftpdlib

Environment overrides:
  FTP_HOST=0.0.0.0
  FTP_PORT=2121
  FTP_USER=user
  FTP_PASS=password
  FTP_HOME=./ftp-root
  FTP_PERMS=elradfmwMT  (default, full perms)

Run:
  export FTP_USER=user FTP_PASS=password FTP_HOME=/path/to/ftp-root
  python3 ftp_server.py

After starting, you can upload to:
  ftp://FTP_USER:FTP_PASS@HOST:PORT/

Note:
- Ensure the FTP_HOME directory exists and is writable by your user.
- Passive ports are automatically managed by pyftpdlib; ensure your firewall allows them if accessing across networks.
"""

import os
import sys
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer

HOST = os.getenv("FTP_HOST", "0.0.0.0")
PORT = int(os.getenv("FTP_PORT", "2121"))
USER = os.getenv("FTP_USER", "testuser")
PASS = os.getenv("FTP_PASS", "testpass")
HOME = os.getenv("FTP_HOME", os.path.abspath(os.path.join(os.path.dirname(__file__), "ftp-root")))
PERMS = os.getenv("FTP_PERMS", "elradfmwMT")  # full perms

os.makedirs(HOME, exist_ok=True)

print(f"[INFO] Starting FTP server on {HOST}:{PORT}")
print(f"[INFO] User: {USER}")
print(f"[INFO] Home: {HOME}")

try:
    authorizer = DummyAuthorizer()
    authorizer.add_user(USER, PASS, HOME, perm=PERMS)
    # authorizer.add_anonymous(HOME)  # uncomment to allow anonymous with same home (read-only by default)

    handler = FTPHandler
    handler.authorizer = authorizer
    handler.passive_ports = range(60000, 60100)  # limit passive port range

    address = (HOST, PORT)
    server = FTPServer(address, handler)

    # Tune for small deployments
    server.max_cons = 50
    server.max_cons_per_ip = 10

    server.serve_forever()
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
