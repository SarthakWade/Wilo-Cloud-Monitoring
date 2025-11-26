from flask import Flask, jsonify, send_from_directory, abort, Response
from flask_socketio import SocketIO
from flask_cors import CORS
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import os
import glob
import datetime
import re
import json
import csv
import numpy as np
from scipy import stats

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])  # Vite default port
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"])

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

def calculate_statistics(z_values):
    """Calculate comprehensive statistical parameters for acceleration data."""
    if not z_values or len(z_values) == 0:
        return {}
    
    z_array = np.array(z_values)
    
    # Basic Amplitude Statistics
    max_val = np.max(z_array)
    min_val = np.min(z_array)
    mean_val = np.mean(z_array)
    abs_mean = np.mean(np.abs(z_array))
    rms = np.sqrt(np.mean(z_array**2))
    variance = np.var(z_array)
    std_dev = np.std(z_array)
    peak = max(abs(max_val), abs(min_val))
    peak_to_peak = max_val - min_val
    
    # Severity / Health Ratios
    crest_factor = peak / rms if rms != 0 else 0
    impulse_factor = peak / abs_mean if abs_mean != 0 else 0
    shape_factor = rms / abs_mean if abs_mean != 0 else 0
    clearance_factor = peak / (np.mean(np.sqrt(np.abs(z_array)))**2) if np.mean(np.sqrt(np.abs(z_array))) != 0 else 0
    
    # Distribution Shape Features
    skewness = stats.skew(z_array)
    kurtosis_val = stats.kurtosis(z_array)
    excess_kurtosis = kurtosis_val  # scipy.stats.kurtosis already returns excess kurtosis by default
    
    # Optional Extras
    energy = np.sum(z_array**2)
    
    # Zero-crossing rate
    zero_crossings = np.sum(np.diff(np.signbit(z_array)))
    zero_crossing_rate = zero_crossings / len(z_array) if len(z_array) > 1 else 0
    
    # Percentiles
    percentile_90 = np.percentile(z_array, 90)
    percentile_95 = np.percentile(z_array, 95)
    percentile_99 = np.percentile(z_array, 99)
    
    return {
        # Basic Amplitude Statistics
        'max': float(max_val),
        'min': float(min_val),
        'mean': float(mean_val),
        'abs_mean': float(abs_mean),
        'rms': float(rms),
        'variance': float(variance),
        'std_dev': float(std_dev),
        'peak': float(peak),
        'peak_to_peak': float(peak_to_peak),
        
        # Severity / Health Ratios
        'crest_factor': float(crest_factor),
        'impulse_factor': float(impulse_factor),
        'shape_factor': float(shape_factor),
        'clearance_factor': float(clearance_factor),
        
        # Distribution Shape Features
        'skewness': float(skewness),
        'kurtosis': float(kurtosis_val),
        'excess_kurtosis': float(excess_kurtosis),
        
        # Optional Extras
        'energy': float(energy),
        'zero_crossing_rate': float(zero_crossing_rate),
        'percentile_90': float(percentile_90),
        'percentile_95': float(percentile_95),
        'percentile_99': float(percentile_99)
    }

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

# Removed template route - now API-only for React frontend

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

def load_20_day_data():
    """Load and aggregate data from multiple max_reading files over the last 20 days."""
    import datetime as dt
    
    # Find all max_reading files
    max_reading_files = glob.glob(os.path.join(DATA_DIR, 'max_reading*.csv'))
    
    if not max_reading_files:
        return [], [], "No max_reading files found"
    
    # Sort files by modification time (newest first)
    max_reading_files.sort(key=os.path.getmtime, reverse=True)
    
    # Calculate 20 days ago
    twenty_days_ago = dt.datetime.now() - dt.timedelta(days=20)
    
    timestamps = []
    z_values = []
    files_processed = 0
    
    # Process files from the last 20 days, limit to ~240 data points
    for file_path in max_reading_files:
        if files_processed >= 240:  # Limit total data points
            break
            
        # Check if file is within 20 days
        file_mtime = dt.datetime.fromtimestamp(os.path.getmtime(file_path))
        if file_mtime < twenty_days_ago:
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                file_data = []
                
                for row in reader:
                    try:
                        # Handle different timestamp formats
                        timestamp_str = row['timestamp']
                        if 'T' in timestamp_str:  # ISO format
                            dt_obj = dt.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                            timestamp = dt_obj.timestamp() * 1000
                        else:
                            timestamp = float(timestamp_str)
                        
                        # Handle different value column names
                        if 'z' in row:
                            z_value = float(row['z'])
                        elif 'value' in row:
                            z_value = float(row['value'])
                        else:
                            continue
                            
                        file_data.append((timestamp, z_value))
                        
                    except (ValueError, KeyError):
                        continue
                
                # Take max value from each file (representing 2-hour max)
                if file_data:
                    # Sort by timestamp and take the maximum value from this file
                    file_data.sort(key=lambda x: x[0])
                    max_entry = max(file_data, key=lambda x: abs(x[1]))  # Max absolute value
                    timestamps.append(max_entry[0])
                    z_values.append(max_entry[1])
                    files_processed += 1
                    
        except Exception as e:
            print(f"Error processing file {file_path}: {e}")
            continue
    
    # Sort by timestamp (oldest first for proper time series)
    if timestamps and z_values:
        combined = list(zip(timestamps, z_values))
        combined.sort(key=lambda x: x[0])
        timestamps, z_values = zip(*combined)
        timestamps, z_values = list(timestamps), list(z_values)
    
    return timestamps, z_values, f"Processed {files_processed} files over 20 days"

@app.route('/chart-data')
def get_chart_data():
    """Get aggregated max_reading CSV data for the chart over 20 days."""
    # Threshold constants
    MAX_THRESHOLD = 0.6
    MIN_THRESHOLD = -0.1
    
    try:
        # Load 20-day aggregated data
        timestamps, z_values, status_msg = load_20_day_data()
        
        if not timestamps:
            return jsonify({'error': 'No data available for the last 20 days'}), 404
        
        # Check for threshold violations in the aggregated data
        max_violations = []
        min_violations = []
        
        for timestamp, z_value in zip(timestamps, z_values):
            if z_value >= MAX_THRESHOLD:
                max_violations.append({'timestamp': timestamp, 'value': z_value})
            if z_value <= MIN_THRESHOLD:
                min_violations.append({'timestamp': timestamp, 'value': z_value})
        
        # Limit to last 500 points for performance
        if len(timestamps) > 500:
            timestamps = timestamps[-500:]
            z_values = z_values[-500:]
        
        # Calculate statistical parameters
        stats_data = calculate_statistics(z_values)
        
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
            'min_violations_count': len(min_violations),
            'statistics': stats_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/parameter-data/<parameter>')
def get_parameter_data(parameter):
    """Get time-series data for a specific statistical parameter."""
    try:
        # Load 20-day aggregated data
        timestamps, z_values, status_msg = load_20_day_data()
        
        if not timestamps:
            return jsonify({'error': 'No data available for the last 20 days'}), 404
        
        # Calculate statistical parameters
        stats_data = calculate_statistics(z_values)
        
        # Get the requested parameter values
        if parameter == 'raw_z':
            parameter_values = z_values
            parameter_label = 'Z-Axis Value'
        elif parameter in stats_data:
            # For statistical parameters, calculate rolling statistics over a window
            # This shows how the parameter evolves over the 20-day period
            window_size = min(7, len(z_values))  # 7-day rolling window or available data
            parameter_values = []
            
            for i in range(len(z_values)):
                # Calculate rolling window
                start_idx = max(0, i - window_size + 1)
                window_data = z_values[start_idx:i+1]
                
                # Calculate statistic for this window
                if len(window_data) > 0:
                    window_stats = calculate_statistics(window_data)
                    if parameter in window_stats:
                        parameter_values.append(window_stats[parameter])
                    else:
                        parameter_values.append(0)
                else:
                    parameter_values.append(0)
            
            parameter_label = parameter.replace('_', ' ').title()
            
            # Improve label formatting
            label_map = {
                'max': 'Maximum',
                'min': 'Minimum', 
                'mean': 'Mean',
                'abs_mean': 'Absolute Mean',
                'rms': 'RMS (Root Mean Square)',
                'variance': 'Variance',
                'std_dev': 'Standard Deviation',
                'peak': 'Peak',
                'peak_to_peak': 'Peak-to-Peak',
                'crest_factor': 'Crest Factor',
                'impulse_factor': 'Impulse Factor',
                'shape_factor': 'Shape Factor',
                'clearance_factor': 'Clearance Factor',
                'skewness': 'Skewness',
                'kurtosis': 'Kurtosis',
                'excess_kurtosis': 'Excess Kurtosis',
                'energy': 'Energy',
                'zero_crossing_rate': 'Zero-Crossing Rate',
                'percentile_90': '90th Percentile',
                'percentile_95': '95th Percentile',
                'percentile_99': '99th Percentile'
            }
            parameter_label = label_map.get(parameter, parameter_label)
        else:
            return jsonify({'error': f'Unknown parameter: {parameter}'}), 400
        
        return jsonify({
            'filename': '20-day aggregated data',
            'timestamps': timestamps,
            'parameter_values': parameter_values,
            'parameter_name': parameter,
            'parameter_label': parameter_label,
            'count': len(timestamps),
            'statistics': stats_data,
            'status': status_msg
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
        socketio.run(app, host='0.0.0.0', port=5001, debug=True)
    finally:
        observer.stop()
        observer.join()