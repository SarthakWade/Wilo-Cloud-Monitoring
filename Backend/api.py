#!/usr/bin/env python3
"""
API module for Wilo-Cloud-Monitoring system.
Provides RESTful endpoints for frontend integration.
"""

import os
import json
import time
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from files import HighFrequencyDataCollector, load_and_analyze_data

class SensorAPIHandler(BaseHTTPRequestHandler):
    # Class variable to hold the data collector instance
    data_collector = None
    # Class variable to track if continuous collection is running
    continuous_collection_running = False
    # Class variable to hold the continuous collection thread
    continuous_collection_thread = None
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/status':
            self.handle_status()
        elif path == '/api/files':
            self.handle_list_files()
        elif path.startswith('/api/file/'):
            self.handle_get_file(parsed_path)
        elif path == '/api/stats':
            self.handle_get_stats()
        elif path == '/api/config':
            self.handle_get_config()
        elif path == '/health':
            self.handle_health_check()
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_POST(self):
        """Handle POST requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/api/start':
            self.handle_start_collection()
        elif path == '/api/stop':
            self.handle_stop_collection()
        elif path == '/api/config':
            self.handle_update_config()
        else:
            self.send_error(404, "Endpoint not found")
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """Send CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def send_json_response(self, data, status_code=200):
        """Send JSON response"""
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def get_request_body(self):
        """Get request body as JSON"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        return json.loads(post_data.decode('utf-8'))
    
    def handle_health_check(self):
        """Health check endpoint"""
        response = {
            'status': 'ok',
            'service': 'Wilo-Cloud-Monitoring API',
            'timestamp': datetime.now().isoformat()
        }
        self.send_json_response(response)
    
    def handle_status(self):
        """Get system status"""
        response = {
            'continuous_collection_running': self.continuous_collection_running,
            'sensor_connected': False if not self.data_collector else not self.data_collector.simulation_mode,
            'sampling_rate': 0 if not self.data_collector else self.data_collector.target_hz,
            'batch_size': 0 if not self.data_collector else self.data_collector.batch_size,
            'timestamp': datetime.now().isoformat()
        }
        self.send_json_response(response)
    
    def handle_list_files(self):
        """List available data files"""
        try:
            readings_dir = 'readings'
            if not os.path.exists(readings_dir):
                files = []
            else:
                files = [f for f in os.listdir(readings_dir) if f.endswith('.csv')]
                # Sort by modification time, newest first
                files.sort(key=lambda x: os.path.getmtime(os.path.join(readings_dir, x)), reverse=True)
                # Convert .csv extensions to .json for the frontend
                files = [f.replace('.csv', '.json') for f in files]
            
            response = {
                'files': files,
                'count': len(files)
            }
            self.send_json_response(response)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_get_file(self, parsed_path):
        """Get a specific data file"""
        try:
            filename = parsed_path.path.split('/')[-1]
            # Convert .json extension back to .csv for file reading
            if filename.endswith('.json'):
                csv_filename = filename.replace('.json', '.csv')
            else:
                csv_filename = filename
            
            filepath = os.path.join('readings', csv_filename)
            
            if not os.path.exists(filepath):
                self.send_json_response({'error': 'File not found'}, 404)
                return
            
            # Read the file and return as JSON in the format expected by the frontend
            with open(filepath, 'r') as f:
                lines = f.readlines()
            
            # Parse CSV and convert to the format expected by the frontend
            if len(lines) < 2:
                readings = []
            else:
                headers = [h.strip() for h in lines[0].strip().split(',')]
                readings = []
                for line in lines[1:]:
                    values = [v.strip() for v in line.strip().split(',')]
                    if len(values) == len(headers):
                        row = dict(zip(headers, values))
                        # Convert to the format expected by the frontend
                        # The frontend expects objects with 'timestamp' and 'acceleration' fields
                        if 'timestamp' in row and 'acceleration' in row:
                            # Convert acceleration to integer
                            try:
                                acceleration = int(row['acceleration'])
                            except ValueError:
                                acceleration = 0
                            readings.append({
                                'timestamp': row['timestamp'],
                                'acceleration': acceleration
                            })
            
            # Return data in the format expected by the frontend
            response = {
                'readings': readings
            }
            self.send_json_response(response)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_get_stats(self):
        """Get system statistics"""
        try:
            # Get file statistics
            readings_dir = 'readings'
            file_count = 0
            total_size = 0
            
            if os.path.exists(readings_dir):
                for f in os.listdir(readings_dir):
                    if f.endswith('.csv'):
                        file_count += 1
                        filepath = os.path.join(readings_dir, f)
                        total_size += os.path.getsize(filepath)
            
            response = {
                'file_count': file_count,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'continuous_collection_running': self.continuous_collection_running,
                'timestamp': datetime.now().isoformat()
            }
            self.send_json_response(response)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_get_config(self):
        """Get current configuration"""
        try:
            if self.data_collector:
                config = {
                    'sampling_rate': self.data_collector.target_hz,
                    'batch_size': self.data_collector.batch_size,
                    'continuous_mode': self.continuous_collection_running,
                    'simulation_mode': self.data_collector.simulation_mode
                }
            else:
                config = {
                    'sampling_rate': 800,
                    'batch_size': 100,
                    'continuous_mode': False,
                    'simulation_mode': True
                }
            
            self.send_json_response(config)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_update_config(self):
        """Update configuration"""
        try:
            data = self.get_request_body()
            
            # If we don't have a data collector yet, create one
            if not self.data_collector:
                self.data_collector = HighFrequencyDataCollector()
                self.data_collector.initialize_sensor()
            
            # Update configuration
            if 'sampling_rate' in data:
                self.data_collector.target_hz = int(data['sampling_rate'])
                self.data_collector.sample_interval = 1.0 / self.data_collector.target_hz
            
            if 'batch_size' in data:
                self.data_collector.batch_size = int(data['batch_size'])
            
            self.send_json_response({'status': 'Configuration updated successfully'})
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_start_collection(self):
        """Start data collection"""
        try:
            # If we don't have a data collector yet, create one
            if not self.data_collector:
                self.data_collector = HighFrequencyDataCollector()
                self.data_collector.initialize_sensor()
            
            # Get parameters from request body
            try:
                data = self.get_request_body()
                duration = int(data.get('duration', 10))  # Default 10 seconds
                continuous = bool(data.get('continuous', False))
            except:
                # If no body or invalid body, use defaults
                duration = 10
                continuous = False
            
            if continuous:
                # Start continuous collection in a separate thread
                if not self.continuous_collection_running:
                    self.continuous_collection_running = True
                    
                    def continuous_worker():
                        while self.continuous_collection_running:
                            try:
                                self.data_collector.collect_continuous(duration_seconds=1)
                                time.sleep(0.01)  # Small pause to prevent excessive CPU usage
                            except Exception as e:
                                print(f"Error in continuous collection: {e}")
                                time.sleep(1)
                    
                    self.continuous_collection_thread = threading.Thread(target=continuous_worker, daemon=True)
                    self.continuous_collection_thread.start()
                    
                    response = {'status': 'Continuous data collection started'}
                else:
                    response = {'status': 'Continuous data collection already running'}
            else:
                # Single collection
                self.data_collector.collect_continuous(duration_seconds=duration)
                response = {'status': f'Data collection completed for {duration} seconds'}
            
            self.send_json_response(response)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)
    
    def handle_stop_collection(self):
        """Stop continuous data collection"""
        try:
            if self.continuous_collection_running:
                self.continuous_collection_running = False
                if self.continuous_collection_thread:
                    self.continuous_collection_thread.join(timeout=2)
                response = {'status': 'Continuous data collection stopped'}
            else:
                response = {'status': 'Continuous data collection was not running'}
            
            self.send_json_response(response)
        except Exception as e:
            self.send_json_response({'error': str(e)}, 500)

def run_api_server(port=8000):
    """Run the API server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, SensorAPIHandler)
    print(f"Starting Sensor API server on port {port}...")
    print(f"API endpoints available at http://localhost:{port}/api/")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_api_server()