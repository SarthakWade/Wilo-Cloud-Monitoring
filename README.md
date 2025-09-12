# Wilo CSV Transfer (RPi -> Ubuntu) - Quick Start

This repo includes a minimal, reliable FTP-based workflow to send CSV files from a Raspberry Pi to an Ubuntu machine and process them automatically.

Components
- `rpi.py`: FTP helper (ls/put/get) using passive mode, retries, and verification
- `sender_watch.py`: Watches `outbox/` for new `.csv` and uploads immediately via `rpi.py`
- `install_sender_service.sh`: Installs a systemd service on the RPi to run `sender_watch.py` until shutdown and on boot
- `ubuntu/process_upload.sh`: Moves CSVs from `/uploads` to `/var/data/incoming` with timestamped names
- `ubuntu/install_listener_service.sh`: Installs a systemd Path unit on Ubuntu to auto-run `process_upload.sh` when `/uploads` changes

Prerequisites
- FTP server runs on the Ubuntu machine:
  - Host: `192.168.1.102`
  - Port: `2121`
  - User: `wilo`
  - Pass: `12345678`
  - Remote upload dir: `/uploads`
- Network connectivity between RPi and Ubuntu

What you will run
- RPi (run 1 file): `install_sender_service.sh`
- Ubuntu (run 2 files):
  1) `ubuntu/install_listener_service.sh` (one-time install; requires sudo)
  2) `ubuntu/process_upload.sh` (optional manual run to process backlog immediately)

After this setup, the services will keep running until shutdown and restart on boot.

RPi Setup (Sender)
1) On the Raspberry Pi, from the repo directory:
   ```bash
   bash install_sender_service.sh
   ```
2) Drop CSV files into `outbox/`. The service will:
   - Wait until the file is stable (not growing)
   - Upload to `/uploads` on the FTP server
   - Move the file to `outbox_sent/` on success, or `outbox_failed/` on repeated failure

Ubuntu Setup (Listener)
1) One-time install (as root):
   ```bash
   sudo bash ubuntu/install_listener_service.sh
   ```
   This will:
   - Install `/usr/local/bin/process_upload.sh`
   - Create and enable a systemd Path unit to trigger processing when `/uploads` changes
   - Ensure `/var/data/incoming` exists

2) Optional manual processing for any existing backlog:
   ```bash
   sudo bash ubuntu/process_upload.sh
   ```
   This moves `/uploads/*.csv` to `/var/data/incoming/` with timestamps.

Verifying
- On RPi:
  ```bash
  mkdir -p outbox
  printf "timestamp,temp,humidity\n$(date +%s),24.3,48\n" > outbox/reading_$(date +%s).csv
  ```
- On Ubuntu:
  ```bash
  ls -l /var/data/incoming | tail -n 5
  ```

Operations / Troubleshooting
- RPi service logs:
  ```bash
  journalctl -u sender-watch.service -n 100 -f
  ```
- Ubuntu listener status:
  ```bash
  systemctl status uploads-changed.path
  journalctl -u uploads-changed.service -n 100 -f
  ```
- Connectivity checks (from RPi):
  ```bash
  python3 rpi.py ls /uploads
  ```

Configuration (optional)
- `sender_watch.py` accepts environment variables:
  - `OUTBOX_DIR` (default: `outbox/`)
  - `REMOTE_DIR` (default: `/uploads`)
  - `STABILITY_WAIT_SEC` (default: `2`)
  - `RETRIES` (default: `3`)
- Edit `/etc/systemd/system/sender-watch.service` to set env vars, then:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl restart sender-watch.service
  ```

Alternative: Periodic fetcher on Ubuntu
- If you prefer to pull files from FTP rather than read `/uploads` directly, set up a timer with `lftp` to fetch from `/uploads` into your app directory. Ask for the `fetch_from_ftp` scripts if needed.
