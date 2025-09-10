import socket
import threading
import time
from datetime import datetime

# ================== Configuration ==================
LISTEN_PORT = 2121
CSV_SAVE_PATH = "received_data.csv"

# Time (in seconds) between checks
CHECK_INTERVAL = 60         # ⏱️ 1 min for debugging
EXPECTED_INTERVAL = 30 * 60 # 🚨 30 min for production (change later)
# ====================================================

last_received_time = None
lock = threading.Lock()

def log(message):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now}] {message}")

def tcp_listener():
    global last_received_time
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.bind(('', LISTEN_PORT))
    server_socket.listen(5)
    log(f"Listening for CSV data on port {LISTEN_PORT}...")

    while True:
        conn, addr = server_socket.accept()
        log(f"Connection from {addr}")
        with open(CSV_SAVE_PATH, "a") as f:
            while True:
                data = conn.recv(1024)
                if not data:
                    break
                f.write(data.decode())
        with lock:
            last_received_time = time.time()
        log(f"Data received and written to {CSV_SAVE_PATH}")
        conn.close()

def monitor_loop():
    global last_received_time
    while True:
        time.sleep(CHECK_INTERVAL)
        with lock:
            if last_received_time is None:
                log("⚠️ No data has been received yet.")
            else:
                elapsed = time.time() - last_received_time
                if elapsed > EXPECTED_INTERVAL:
                    mins = int(elapsed // 60)
                    log(f"⚠️ No data received in the last {mins} minutes! Possible connection issue.")
                else:
                    mins = int(elapsed // 60)
                    log(f"✅ Last data received {mins} minutes ago. All good.")

def main():
    # Start the listener in a separate thread
    listener_thread = threading.Thread(target=tcp_listener, daemon=True)
    listener_thread.start()

    # Start the monitor in the main thread
    monitor_loop()

if __name__ == "__main__":
    main()
