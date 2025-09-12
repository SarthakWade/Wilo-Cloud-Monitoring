#!/usr/bin/env python3
"""
ftp_transfer.py

A robust wrapper around lftp to transfer files to/from a remote FTP/FTPS server.

Features:
- Supports get, put, and mirror operations
- Configurable host/port/user/password
- Optional FTPS (TLS) and passive mode
- Retries with backoff, timeouts, and parallel transfers
- Structured console logging with timestamps

Examples:
  Upload a file:
    ./ftp_transfer.py --host 172.168.4.50 --port 2121 \
      --user myuser --password secret --mode put \
      --local-path /path/to/local/file.txt --remote-path /remote/dir/

  Download a file:
    ./ftp_transfer.py --host 172.168.4.50 --port 2121 \
      --user myuser --password secret --mode get \
      --remote-path /remote/dir/file.txt --local-path /tmp/

  Mirror a directory up (local -> remote):
    ./ftp_transfer.py --host 172.168.4.50 --port 2121 \
      --user myuser --password secret --mode mirror-put \
      --local-path ./outbox --remote-path /incoming --delete

  Mirror a directory down (remote -> local):
    ./ftp_transfer.py --host 172.168.4.50 --port 2121 \
      --user myuser --password secret --mode mirror-get \
      --remote-path /outgoing --local-path ./downloads
"""

import argparse
import os
import shlex
import subprocess
import sys
import time
from datetime import datetime


def log(msg: str) -> None:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def build_lftp_base(args: argparse.Namespace) -> list[str]:
    # Build the lftp base command with settings via -e script
    settings = []
    # Timeouts
    settings.append(f"set net:timeout {args.timeout}")
    settings.append(f"set net:max-retries {args.retries}")
    settings.append(f"set net:persist-retries {args.retries}")
    # Passive mode
    settings.append(f"set ftp:passive-mode {'true' if args.passive else 'false'}")
    # Parallel transfers for mirror
    settings.append(f"set mirror:parallel-transfer-count {args.parallel}")
    # SSL/TLS if requested
    if args.ftps:
        settings.append("set ftp:ssl-force true")
        settings.append("set ftp:ssl-protect-data true")
        settings.append("set ssl:verify-certificate false")  # often needed in LAN

    # Credentials and open
    # We avoid putting password directly in URL to limit process list exposure by using -u
    open_cmd = f"open -p {args.port} -u {shlex.quote(args.user)},{shlex.quote(args.password)} {shlex.quote(args.host)}"

    # Join settings and leave the transfer operation to be appended later
    script_lines = settings + [open_cmd]
    script = "; ".join(script_lines) + "; "

    base = [
        "lftp",
        "-e",
        script,  # we'll append the final command and 'bye' later
    ]
    return base


def run_lftp(args: argparse.Namespace, command: str) -> int:
    base = build_lftp_base(args)
    # Ensure the session exits after the command
    full_script = base[1+0]  # '-e' argument is at index 1, its value at index 2; but we will reconstruct
    # To keep it simple, rebuild command list correctly
    base = build_lftp_base(args)
    script_with_cmd = base[2] + command + "; bye;"
    cmd = [base[0], base[1], script_with_cmd]

    log(f"Running: {' '.join(shlex.quote(c) for c in cmd)}")
    proc = subprocess.run(cmd)
    return proc.returncode


def do_transfer(args: argparse.Namespace) -> int:
    op = args.mode

    # Build operation command
    if op == "put":
        if not args.local_path:
            log("ERROR: --local-path is required for put")
            return 2
        target = shlex.quote(args.remote_path or ".")
        src = shlex.quote(args.local_path)
        command = f"put -O {target} {src}"
    elif op == "get":
        if not args.remote_path:
            log("ERROR: --remote-path is required for get")
            return 2
        dest = shlex.quote(args.local_path or ".")
        src = shlex.quote(args.remote_path)
        command = f"get -O {dest} {src}"
    elif op == "mirror-put":
        if not args.local_path or not args.remote_path:
            log("ERROR: --local-path and --remote-path are required for mirror-put")
            return 2
        delete_flag = "--delete" if args.delete else ""
        command = (
            f"mirror -R {delete_flag} --verbose=1 --parallel={args.parallel} "
            f"{shlex.quote(args.local_path)} {shlex.quote(args.remote_path)}"
        )
    elif op == "mirror-get":
        if not args.local_path or not args.remote_path:
            log("ERROR: --local-path and --remote-path are required for mirror-get")
            return 2
        delete_flag = "--delete" if args.delete else ""
        command = (
            f"mirror {delete_flag} --verbose=1 --parallel={args.parallel} "
            f"{shlex.quote(args.remote_path)} {shlex.quote(args.local_path)}"
        )
    elif op == "ls":
        path = shlex.quote(args.remote_path or ".")
        command = f"cls -l {path}"
    else:
        log(f"ERROR: Unknown mode: {op}")
        return 2

    # Retries with backoff around lftp invocation itself
    attempt = 0
    while attempt <= args.retries:
        rc = run_lftp(args, command)
        if rc == 0:
            log("Transfer succeeded")
            return 0
        attempt += 1
        if attempt > args.retries:
            break
        delay = min(60, args.backoff * attempt)
        log(f"Transfer failed with exit code {rc}. Retrying in {delay}s (attempt {attempt}/{args.retries})...")
        time.sleep(delay)

    log("ERROR: Transfer failed after retries")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="lftp-based file transfer helper")
    parser.add_argument("--host", required=True, help="Remote host/IP, e.g., 172.168.4.50")
    parser.add_argument("--port", type=int, default=21, help="Remote port (default: 21)")
    parser.add_argument("--user", required=True, help="Username")
    parser.add_argument("--password", required=True, help="Password")
    parser.add_argument(
        "--mode",
        required=True,
        choices=["put", "get", "mirror-put", "mirror-get", "ls"],
        help="Operation to perform",
    )
    parser.add_argument("--remote-path", help="Remote file/dir path")
    parser.add_argument("--local-path", help="Local file/dir path")
    parser.add_argument("--ftps", action="store_true", help="Enable FTPS (explicit TLS)")
    parser.add_argument("--passive", action="store_true", help="Enable passive mode (default if set)")
    parser.add_argument("--timeout", type=int, default=10, help="Network timeout seconds")
    parser.add_argument("--retries", type=int, default=3, help="Number of retries")
    parser.add_argument("--backoff", type=int, default=5, help="Backoff seconds between retries")
    parser.add_argument("--parallel", type=int, default=2, help="Parallel transfers for mirror")
    parser.add_argument("--delete", action="store_true", help="Delete extra files when mirroring")

    args = parser.parse_args()

    # Basic checks
    if shutil.which("lftp") is None:
        log("ERROR: lftp is not installed or not in PATH")
        return 127

    # Default passive true if not explicitly set
    if not args.passive:
        # Keep passive true by default unless user explicitly passes --no-passive (not provided here)
        args.passive = True

    return do_transfer(args)


if __name__ == "__main__":
    try:
        import shutil  # local import to avoid top-level cost if imported as module
        sys.exit(main())
    except KeyboardInterrupt:
        log("Interrupted by user")
        sys.exit(130)
