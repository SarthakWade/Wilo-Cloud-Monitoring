#!/usr/bin/env bash
set -euo pipefail

# Configuration
WORKDIR="/home/willo/Desktop/Wilo-Cloud-Monitoring"
SERVICE_NAME="sender-watch.service"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}"
PYTHON="/usr/bin/python3"
USER_NAME="willo"

# Ensure working directory exists and required files are present
if [[ ! -d "$WORKDIR" ]]; then
  echo "Working directory not found: $WORKDIR" >&2
  exit 1
fi
cd "$WORKDIR"

if [[ ! -f "sender_watch.py" ]]; then
  echo "sender_watch.py not found in $WORKDIR" >&2
  exit 1
fi
if [[ ! -f "rpi.py" ]]; then
  echo "rpi.py not found in $WORKDIR" >&2
  exit 1
fi

# Create data dirs
mkdir -p outbox outbox_sent outbox_failed

# Create systemd unit
sudo tee "$UNIT_PATH" >/dev/null <<UNIT
[Unit]
Description=CSV Sender Watch (RPi) - upload new CSVs from outbox to FTP /uploads
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$WORKDIR
ExecStart=$PYTHON sender_watch.py
Restart=always
RestartSec=3
User=$USER_NAME
Environment=PYTHONUNBUFFERED=1
# Optional overrides:
# Environment=OUTBOX_DIR=$WORKDIR/outbox
# Environment=REMOTE_DIR=/uploads
# Environment=STABILITY_WAIT_SEC=2
# Environment=RETRIES=3

[Install]
WantedBy=multi-user.target
UNIT

# Reload and enable service
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"

# Show status
systemctl --no-pager -l status "$SERVICE_NAME" || true

echo
echo "Installed and started $SERVICE_NAME."
echo "Drop CSV files into: $WORKDIR/outbox/"
echo "Check logs: journalctl -u $SERVICE_NAME -n 100 -f"
