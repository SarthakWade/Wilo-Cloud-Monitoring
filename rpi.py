#!/usr/bin/env python3
import argparse
import ftplib
import os
import sys
from pathlib import Path
from datetime import datetime
import time

SERVER = "192.168.1.102"
PORT = 2121
USER = "wilo"
PASS = "12345678"

def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def connect():
    ftp = ftplib.FTP()
    ftp.connect(SERVER, PORT, timeout=10)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    return ftp

def ftp_put(local_path: str, remote_dir: str) -> None:
    ftp = connect()
    try:
        if remote_dir:
            ftp.cwd(remote_dir)
        fname = os.path.basename(local_path)
        with open(local_path, "rb") as f:
            log(f"Uploading {local_path} -> {remote_dir}/{fname}")
            ftp.storbinary(f"STOR {fname}", f)
        log("Upload complete")
    finally:
        ftp.quit()

def ftp_get(remote_path: str, local_dir: str) -> None:
    ftp = connect()
    try:
        Path(local_dir).mkdir(parents=True, exist_ok=True)
        fname = os.path.basename(remote_path.rstrip("/"))
        local_path = os.path.join(local_dir, fname)
        with open(local_path, "wb") as f:
            log(f"Downloading {remote_path} -> {local_path}")
            ftp.retrbinary(f"RETR {remote_path}", f.write)
        log("Download complete")
    finally:
        ftp.quit()

def ftp_ls(path: str) -> None:
    ftp = connect()
    try:
        log(f"Listing {path or '/'}")
        ftp.retrlines(f"LIST {path or ''}")
    finally:
        ftp.quit()

def main():
    p = argparse.ArgumentParser(description="Simple FTP client to 192.168.1.102:2121")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_ls = sub.add_parser("ls")
    p_ls.add_argument("remote_path", nargs="?", default="/")

    p_put = sub.add_parser("put")
    p_put.add_argument("local_path")
    p_put.add_argument("remote_dir")

    p_get = sub.add_parser("get")
    p_get.add_argument("remote_path")
    p_get.add_argument("local_dir")

    args = p.parse_args()

    try:
        if args.cmd == "ls":
            ftp_ls(args.remote_path)
        elif args.cmd == "put":
            ftp_put(args.local_path, args.remote_dir)
        elif args.cmd == "get":
            ftp_get(args.remote_path, args.local_dir)
    except ftplib.all_errors as e:
        log(f"FTP error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()