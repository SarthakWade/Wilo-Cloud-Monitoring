# #!/usr/bin/env python3
# import argparse
# <<<<<<< HEAD
# import ftplib
# import os
# import sys
# from pathlib import Path
# from datetime import datetime
# import time

# SERVER = "192.168.1.102"
# PORT = 2121
# USER = "wilo"
# PASS = "12345678"

# def log(msg: str) -> None:
#     print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

# def connect():
#     ftp = ftplib.FTP()
#     ftp.connect(SERVER, PORT, timeout=10)
#     ftp.login(USER, PASS)
#     ftp.set_pasv(True)
#     return ftp

# def ftp_put(local_path: str, remote_dir: str) -> None:
#     ftp = connect()
#     try:
#         if remote_dir:
#             ftp.cwd(remote_dir)
#         fname = os.path.basename(local_path)
#         with open(local_path, "rb") as f:
#             log(f"Uploading {local_path} -> {remote_dir}/{fname}")
#             ftp.storbinary(f"STOR {fname}", f)
#         log("Upload complete")
#     finally:
#         ftp.quit()

# def ftp_get(remote_path: str, local_dir: str) -> None:
#     ftp = connect()
#     try:
#         Path(local_dir).mkdir(parents=True, exist_ok=True)
#         fname = os.path.basename(remote_path.rstrip("/"))
#         local_path = os.path.join(local_dir, fname)
#         with open(local_path, "wb") as f:
#             log(f"Downloading {remote_path} -> {local_path}")
#             ftp.retrbinary(f"RETR {remote_path}", f.write)
#         log("Download complete")
#     finally:
#         ftp.quit()

# def ftp_ls(path: str) -> None:
#     ftp = connect()
#     try:
#         log(f"Listing {path or '/'}")
#         ftp.retrlines(f"LIST {path or ''}")
#     finally:
#         ftp.quit()

# def main():
#     p = argparse.ArgumentParser(description="Simple FTP client to 192.168.1.102:2121")
#     sub = p.add_subparsers(dest="cmd", required=True)

#     p_ls = sub.add_parser("ls")
#     p_ls.add_argument("remote_path", nargs="?", default="/")

#     p_put = sub.add_parser("put")
#     p_put.add_argument("local_path")
#     p_put.add_argument("remote_dir")

#     p_get = sub.add_parser("get")
#     p_get.add_argument("remote_path")
#     p_get.add_argument("local_dir")

#     args = p.parse_args()

#     try:
#         if args.cmd == "ls":
#             ftp_ls(args.remote_path)
#         elif args.cmd == "put":
#             ftp_put(args.local_path, args.remote_dir)
#         elif args.cmd == "get":
#             ftp_get(args.remote_path, args.local_dir)
#     except ftplib.all_errors as e:
#         log(f"FTP error: {e}")
#         sys.exit(1)

# if __name__ == "__main__":
#     main()
# =======
# import os
# import sys
# import time
# import socket
# import shutil
# import subprocess
# from ftplib import FTP, error_perm, all_errors
# from typing import List, Tuple

# # Defaults per requirements
# SERVER = os.environ.get("FTP_SERVER", "192.168.1.102")
# PORT = int(os.environ.get("FTP_PORT", "2121"))
# USER = os.environ.get("FTP_USER", "wilo")
# PASS = os.environ.get("FTP_PASS", "12345678")
# PASSIVE = True  # Always passive

# RETRIES = 3
# RETRY_DELAY_SEC = 3

# def run(cmd: List[str]) -> Tuple[int, str, str]:
#     try:
#         proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
#         return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
#     except Exception as e:
#         return 1, "", str(e)

# def check_reachability(host: str, port: int) -> None:
#     # Ping check
#     rc, out, err = run(["ping", "-c", "3", host])
#     if rc != 0:
#         print("reachability: ping failed", flush=True)
#         print(f"details: {err or out}", flush=True)
#     else:
#         print("reachability: ping ok", flush=True)

#     # Optional nc port check
#     nc_path = shutil.which("nc")
#     if nc_path:
#         rc, out, err = run([nc_path, "-zv", host, str(port)])
#         if rc == 0:
#             print("port: nc connect ok", flush=True)
#         else:
#             # OpenBSD nc exits non-zero when connection refused; show stderr for clarity
#             print("port: nc check failed", flush=True)
#             print(f"details: {err or out}", flush=True)
#     else:
#         # Fallback: quick TCP attempt with socket
#         try:
#             with socket.create_connection((host, port), timeout=3):
#                 print("port: tcp connect ok (socket)", flush=True)
#         except Exception as e:
#             print(f"port: tcp connect failed (socket): {e}", flush=True)

# def connect_ftp(host: str, port: int, user: str, password: str, passive: bool = True) -> FTP:
#     ftp = FTP()
#     ftp.connect(host, port, timeout=10)
#     ftp.login(user, password)
#     ftp.set_pasv(passive)
#     return ftp

# def retry(action_name: str):
#     def decorator(func):
#         def wrapper(*args, **kwargs):
#             last_exc = None
#             for attempt in range(1, RETRIES + 1):
#                 try:
#                     return func(*args, **kwargs)
#                 except all_errors as e:
#                     last_exc = e
#                     print(f"{action_name}: attempt {attempt} failed: {e}", flush=True)
#                     if attempt < RETRIES:
#                         time.sleep(RETRY_DELAY_SEC)
#             # Raise last exception after retries
#             raise last_exc
#         return wrapper
#     return decorator

# @retry("ls")
# def ftp_list_dir(remote_dir: str) -> List[str]:
#     ftp = None
#     try:
#         ftp = connect_ftp(SERVER, PORT, USER, PASS, PASSIVE)
#         lines: List[str] = []
#         ftp.cwd(remote_dir)
#         ftp.retrlines("LIST", lines.append)
#         return lines
#     finally:
#         if ftp:
#             try:
#                 ftp.quit()
#             except Exception:
#                 try:
#                     ftp.close()
#                 except Exception:
#                     pass

# @retry("put")
# def ftp_upload(local_path: str, remote_dir: str) -> None:
#     # Verify local file exists and not empty; if missing, create a small test file
#     if not os.path.exists(local_path):
#         # Create a small test file as allowed
#         try:
#             with open(local_path, "w", encoding="utf-8") as f:
#                 f.write("wilo test file\n")
#         except Exception as e:
#             raise RuntimeError(f"cannot create local file {local_path}: {e}")

#     if os.path.isdir(local_path):
#         raise RuntimeError(f"local path is a directory: {local_path}")

#     if os.path.getsize(local_path) == 0:
#         raise RuntimeError(f"local file is empty: {local_path}")

#     basename = os.path.basename(local_path)
#     ftp = None
#     try:
#         ftp = connect_ftp(SERVER, PORT, USER, PASS, PASSIVE)
#         ftp.cwd(remote_dir)
#         with open(local_path, "rb") as f:
#             ftp.storbinary(f"STOR {basename}", f)
#     finally:
#         if ftp:
#             try:
#                 ftp.quit()
#             except Exception:
#                 try:
#                     ftp.close()
#                 except Exception:
#                     pass

# @retry("get")
# def ftp_download(remote_path: str, local_dir: str) -> str:
#     if not local_dir:
#         local_dir = "."
#     if not os.path.exists(local_dir):
#         os.makedirs(local_dir, exist_ok=True)
#     if not os.path.isdir(local_dir):
#         raise RuntimeError(f"local destination is not a directory: {local_dir}")

#     remote_name = os.path.basename(remote_path.rstrip("/"))
#     if not remote_name:
#         raise RuntimeError(f"invalid remote file name from path: {remote_path}")

#     local_out = os.path.join(local_dir, remote_name)

#     ftp = None
#     try:
#         ftp = connect_ftp(SERVER, PORT, USER, PASS, PASSIVE)
#         # Change to directory part if provided
#         remote_dir = os.path.dirname(remote_path) or "/"
#         ftp.cwd(remote_dir)
#         with open(local_out, "wb") as f:
#             ftp.retrbinary(f"RETR {remote_name}", f.write)
#         return local_out
#     finally:
#         if ftp:
#             try:
#                 ftp.quit()
#             except Exception:
#                 try:
#                     ftp.close()
#                 except Exception:
#                     pass

# def cmd_ls(remote_dir: str) -> int:
#     print(f"operation: ls", flush=True)
#     print(f"server: {SERVER}:{PORT}", flush=True)
#     print(f"user: {USER}", flush=True)
#     print(f"dir: {remote_dir}", flush=True)

#     check_reachability(SERVER, PORT)
#     try:
#         listing = ftp_list_dir(remote_dir)
#         # Show a short snippet (up to 10 lines)
#         print("result: success", flush=True)
#         print("list_snippet:")
#         for line in listing[:10]:
#             print(f"  {line}")
#         return 0
#     except Exception as e:
#         print("result: failure", flush=True)
#         print(f"error: {e}", flush=True)
#         print("suggestion: verify credentials, server availability, and remote directory path.", flush=True)
#         return 1

# def cmd_put(local_path: str, remote_dir: str) -> int:
#     print(f"operation: put", flush=True)
#     print(f"server: {SERVER}:{PORT}", flush=True)
#     print(f"user: {USER}", flush=True)
#     print(f"source: {local_path}", flush=True)
#     print(f"dest_dir: {remote_dir}", flush=True)

#     check_reachability(SERVER, PORT)
#     try:
#         ftp_upload(local_path, remote_dir)
#         # Verification by listing remote_dir and checking file presence
#         basename = os.path.basename(local_path)
#         listing = ftp_list_dir(remote_dir)
#         found = any(basename in line.split()[-1] for line in listing if line.strip())
#         print("result: success" if found else "result: uncertain", flush=True)
#         print("verification:")
#         # show lines that match or first few lines
#         matched = [l for l in listing if l.endswith(f" {basename}") or l.endswith(f" {basename}\r")]
#         snippet = matched if matched else listing[:10]
#         for line in snippet[:10]:
#             print(f"  {line}")
#         if not found:
#             print("note: file not clearly found in listing; check server-side permissions or naming.", flush=True)
#         return 0 if found else 2
#     except Exception as e:
#         print("result: failure", flush=True)
#         print(f"error: {e}", flush=True)
#         print("suggestion: ensure local file exists and server /uploads is writable.", flush=True)
#         return 1

# def cmd_get(remote_path: str, local_dir: str) -> int:
#     print(f"operation: get", flush=True)
#     print(f"server: {SERVER}:{PORT}", flush=True)
#     print(f"user: {USER}", flush=True)
#     print(f"source: {remote_path}", flush=True)
#     print(f"dest_dir: {local_dir or '.'}", flush=True)

#     check_reachability(SERVER, PORT)
#     try:
#         local_out = ftp_download(remote_path, local_dir or ".")
#         size = os.path.getsize(local_out) if os.path.exists(local_out) else -1
#         ok = os.path.exists(local_out) and size >= 0
#         print("result: success" if ok else "result: failure", flush=True)
#         print("verification:")
#         if ok:
#             print(f"  local_file: {local_out}", flush=True)
#             print(f"  size: {size} bytes", flush=True)
#         else:
#             print("  local file missing after download", flush=True)
#         return 0 if ok else 1
#     except Exception as e:
#         print("result: failure", flush=True)
#         print(f"error: {e}", flush=True)
#         print("suggestion: verify remote path and permissions. Ensure /downloads exists.", flush=True)
#         return 1

# def parse_args(argv: List[str]) -> argparse.Namespace:
#     parser = argparse.ArgumentParser(
#         description="Raspberry Pi FTP helper (ls/put/get) with passive mode, retries, and verification."
#     )
#     sub = parser.add_subparsers(dest="cmd", required=True)

#     p_ls = sub.add_parser("ls", help="List remote directory")
#     p_ls.add_argument("remote_dir", help="Remote directory to list, e.g., / or /uploads")

#     p_put = sub.add_parser("put", help="Upload local file to remote directory")
#     p_put.add_argument("local_path", help="Local file path to upload")
#     p_put.add_argument("remote_dir", help="Remote directory (e.g., /uploads)")

#     p_get = sub.add_parser("get", help="Download remote file to local directory")
#     p_get.add_argument("remote_path", help="Remote file path (e.g., /downloads/sample.txt)")
#     p_get.add_argument("local_dir", nargs="?", default=".", help="Local directory to save into (default: .)")

#     return parser.parse_args(argv)

# def main(argv: List[str]) -> int:
#     args = parse_args(argv)
#     if args.cmd == "ls":
#         return cmd_ls(args.remote_dir)
#     elif args.cmd == "put":
#         return cmd_put(args.local_path, args.remote_dir)
#     elif args.cmd == "get":
#         return cmd_get(args.remote_path, args.local_dir)
#     else:
#         print("Unknown command", flush=True)
#         return 2

# if __name__ == "__main__":
#     sys.exit(main(sys.argv[1:]))
# >>>>>>> ab79088 (heavy push)
