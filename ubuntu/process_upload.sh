#!/usr/bin/env bash
set -euo pipefail

# This script runs on the Ubuntu (listener/server) machine.
# It moves CSVs from /uploads to /var/data/incoming with a timestamped filename.

SRC_DIR="/uploads"
DEST_DIR="/var/data/incoming"
LOG_PREFIX="[process_upload]"

if [[ $EUID -ne 0 ]]; then
  echo "$LOG_PREFIX please run as root (sudo) to access /uploads and /var/data" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
shopt -s nullglob

moved_any=0
for f in "$SRC_DIR"/*.csv; do
  base=$(basename "$f")
  ts=$(date +%Y%m%d-%H%M%S)
  dest="$DEST_DIR/${base%.csv}.$ts.csv"
  mv "$f" "$dest"
  echo "$LOG_PREFIX moved: $f -> $dest"
  moved_any=1
done

if [[ $moved_any -eq 0 ]]; then
  echo "$LOG_PREFIX nothing to move (no CSVs in $SRC_DIR)"
fi
