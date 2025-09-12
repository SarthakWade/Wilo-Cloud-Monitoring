#!/usr/bin/env bash
set -euo pipefail

# This script configures the Ubuntu (listener/server) machine to
# automatically process CSV files arriving in /uploads.
# It installs a systemd Path unit that triggers process_upload.sh
# whenever /uploads changes. It also ensures /var/data/incoming exists.

SERVICE_NAME="uploads-changed.service"
PATH_NAME="uploads-changed.path"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}"
PATH_UNIT_PATH="/etc/systemd/system/${PATH_NAME}"
PROCESSOR_SCRIPT="/usr/local/bin/process_upload.sh"
SRC_REPO_SCRIPT="$(pwd)/ubuntu/process_upload.sh"
DEST_DIR="/var/data/incoming"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root: sudo bash ubuntu/install_listener_service.sh" >&2
  exit 1
fi

# Install processor script to /usr/local/bin and make it executable
if [[ ! -f "$SRC_REPO_SCRIPT" ]]; then
  echo "Source script not found: $SRC_REPO_SCRIPT" >&2
  exit 1
fi
install -m 0755 "$SRC_REPO_SCRIPT" "$PROCESSOR_SCRIPT"

# Ensure destination directory exists
mkdir -p "$DEST_DIR"
chmod 755 "$DEST_DIR"

# Create service that runs the processor script once when triggered
cat > "$SERVICE_PATH" <<UNIT
[Unit]
Description=Process new CSVs from /uploads into $DEST_DIR

[Service]
Type=oneshot
ExecStart=$PROCESSOR_SCRIPT
UNIT

# Create path unit that watches /uploads for changes
cat > "$PATH_UNIT_PATH" <<UNIT
[Unit]
Description=Watch /uploads and trigger processing

[Path]
PathChanged=/uploads
Unit=$SERVICE_NAME

[Install]
WantedBy=multi-user.target
UNIT

# Reload and enable
systemctl daemon-reload
systemctl enable --now "$PATH_NAME"

# Show status
systemctl --no-pager -l status "$PATH_NAME" || true

echo
echo "Installed and started $PATH_NAME."
echo "Files arriving in /uploads will be moved into $DEST_DIR automatically."
echo "To view logs: journalctl -u $SERVICE_NAME -n 100 -f"
