#!/usr/bin/env python3
import os
import csv
import time
import logging
from datetime import datetime

# === CONFIG ===
WATCH_DIR = "/home/vu-server/Desktop/Wilo-Cloud-Monitoring/Data"  # Folder where files arrive
LOG_DIR = "/home/vu-server/Desktop/Wilo-Cloud-Monitoring/Server/logs"
CSV_FILE = os.path.join(LOG_DIR, "file_log.csv")
LOG_FILE = os.path.join(LOG_DIR, "server.log")
POLL_INTERVAL = 5  # seconds between checks

# === SETUP DIRECTORIES ===
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(WATCH_DIR, exist_ok=True)

# === LOGGING CONFIG ===
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

def count_entries(filepath):
    """
    Counts the number of lines/entries if it's a CSV or text file.
    Returns None if not readable as text.
    """
    try:
        with open(filepath, "r") as f:
            return sum(1 for _ in f) - 1  # assuming first row is header
    except Exception:
        return None

def write_to_csv(file_info):
    """
    Appends file info to CSV log.
    """
    file_exists = os.path.isfile(CSV_FILE)
    with open(CSV_FILE, "a", newline="") as csvfile:
        writer = csv.writer(csvfile)
        if not file_exists:
            # Write headers once
            writer.writerow(["Timestamp", "File Name", "File Size (KB)", "Entries"])
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            file_info["name"],
            round(file_info["size"] / 1024, 2),
            file_info["entries"] if file_info["entries"] is not None else "N/A"
        ])

def main():
    logging.info("File monitoring service started. Watching for new files.")
    seen_files = set(os.listdir(WATCH_DIR))  # track already-existing files

    while True:
        try:
            current_files = set(os.listdir(WATCH_DIR))
            new_files = current_files - seen_files

            for filename in new_files:
                filepath = os.path.join(WATCH_DIR, filename)
                if os.path.isfile(filepath):
                    size = os.path.getsize(filepath)
                    entries = count_entries(filepath)
                    file_info = {"name": filename, "size": size, "entries": entries}

                    # Log to CSV and server log
                    write_to_csv(file_info)
                    logging.info(f"Received file: {filename}, Size: {size} bytes, Entries: {entries}")

            seen_files = current_files
        except Exception as e:
            logging.error(f"Error while processing files: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
