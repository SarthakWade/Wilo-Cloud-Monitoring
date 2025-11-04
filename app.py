from flask import Flask, render_template, jsonify, send_from_directory, abort, Response
from flask_socketio import SocketIO
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import glob
import datetime
import re
import json
import csv

app = Flask(__name__)
socketio = SocketIO(app)

# Configure the data directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'Data')
FNAME_RE = re.compile(r"^[^/\\]+\.csv$")  # simple guard against path traversal
os.makedirs(DATA_DIR, exist_ok=True)

def load_config():
    cfg_path = os.path.join(BASE_DIR, 'config.json')
    default_cfg = {"interval_seconds": 300}
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            cfg = json.load(f)
            if not isinstance(cfg.get('interval_seconds'), int):
                return default_cfg
            return cfg
    except (FileNotFoundError, json.JSONDecodeError):
        return default_cfg

CONFIG = load_config()

class FileChangeHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.endswith('.csv'):
            # Emit the new file event to connected clients
            file_info = get_file_info(event.src_path)
            socketio.emit('file_created', file_info)

    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.csv'):
            # Emit the file modified event to connected clients
            file_info = get_file_info(event.src_path)
            socketio.emit('file_modified', file_info)

def get_file_info(filepath):
    stats = os.stat(filepath)
    return {
        'name': os.path.basename(filepath),
        'size': stats.st_size,
        'modified': datetime.datetime.fromtimestamp(stats.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
        'path': filepath
    }

@app.route('/')
def index():
    return render_template('index.html', interval_seconds=CONFIG.get('interval_seconds', 300))

@app.route('/files')
def get_files():
    files = []
    for filepath in glob.glob(os.path.join(DATA_DIR, '*.csv')):
        files.append(get_file_info(filepath))
    return jsonify(files)

def _resolve_csv_path(name: str) -> str:
    """Validate and resolve CSV path within DATA_DIR."""
    if not FNAME_RE.match(name or ""):
        abort(400, description="Invalid file name")
    fpath = os.path.join(DATA_DIR, name)
    if not os.path.isfile(fpath):
        abort(404, description="File not found")
    return fpath

@app.route('/download/<path:name>')
def download_file(name):
    # Validate and serve as attachment
    _resolve_csv_path(name)
    return send_from_directory(DATA_DIR, name, as_attachment=True, mimetype='text/csv', download_name=name)

@app.route('/view/<path:name>')
def view_file(name):
    # Stream a small preview inline (first ~200 KB) as text for quick viewing
    fpath = _resolve_csv_path(name)
    try:
        chunks = []
        read_bytes = 0
        limit = 200 * 1024  # 200 KB preview
        with open(fpath, 'rb') as f:
            while read_bytes < limit:
                chunk = f.read(min(16 * 1024, limit - read_bytes))
                if not chunk:
                    break
                chunks.append(chunk)
                read_bytes += len(chunk)
        content = b''.join(chunks)
        # Ensure text rendering in browser
        return Response(content, mimetype='text/plain; charset=utf-8', headers={
            'Cache-Control': 'no-store'
        })
    except OSError:
        abort(500, description="Error reading file")

@app.route('/chart-data')
def get_chart_data():
    """Get the latest max_reading CSV data for the chart."""
    # Threshold constants
    MAX_THRESHOLD = 0.6
    MIN_THRESHOLD = -0.1
    
    try:
        # Find all max_reading files
        max_reading_files = glob.glob(os.path.join(DATA_DIR, 'max_reading*.csv'))
        
        if not max_reading_files:
            return jsonify({'error': 'No max_reading files found'}), 404
        
        # Get the most recent file by modification time
        latest_file = max(max_reading_files, key=os.path.getmtime)
        filename = os.path.basename(latest_file)
        
        # Read the CSV data
        timestamps = []
        z_values = []
        max_violations = []
        min_violations = []
        
        with open(latest_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    timestamp = float(row['timestamp'])
                    z_value = float(row['z'])
                    timestamps.append(timestamp)
                    z_values.append(z_value)
                    
                    # Check for threshold violations
                    if z_value >= MAX_THRESHOLD:
                        max_violations.append({'timestamp': timestamp, 'value': z_value})
                    if z_value <= MIN_THRESHOLD:
                        min_violations.append({'timestamp': timestamp, 'value': z_value})
                except (ValueError, KeyError):
                    continue
        
        # Limit to last 500 points for performance
        if len(timestamps) > 500:
            timestamps = timestamps[-500:]
            z_values = z_values[-500:]
        
        return jsonify({
            'filename': filename,
            'timestamps': timestamps,
            'z_values': z_values,
            'count': len(timestamps),
            'max_threshold': MAX_THRESHOLD,
            'min_threshold': MIN_THRESHOLD,
            'max_violations': max_violations,
            'min_violations': min_violations,
            'max_violations_count': len(max_violations),
            'min_violations_count': len(min_violations)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Set up the file system observer
    observer = Observer()
    event_handler = FileChangeHandler()
    observer.schedule(event_handler, DATA_DIR, recursive=False)
    observer.start()

    try:
        # Run the Flask app on all network interfaces
        print(' * Starting Flask application...')
        socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    finally:
        observer.stop()
        observer.join()