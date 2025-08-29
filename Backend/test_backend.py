#!/usr/bin/env python3
"""
Simple backend simulation for testing cloud upload functionality.
This script creates a simple HTTP server that accepts POST requests
with CSV data and saves them to a 'uploaded_files' directory.
"""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import cgi

class UploadHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Parse the URL
        parsed_path = urlparse(self.path)
        
        # Check if this is the correct endpoint
        if parsed_path.path == '/api/data':
            # Get the authorization header
            auth_header = self.headers.get('Authorization')
            
            # Check if authorization is provided
            if not auth_header:
                self.send_response(401)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': 'Authorization header missing'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Extract the token (Bearer token)
            if not auth_header.startswith('Bearer '):
                self.send_response(401)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': 'Invalid authorization header'}
                self.wfile.write(json.dumps(response).encode())
                return
                
            token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            # In a real system, you would verify the token here
            # For simulation, we'll just accept any token
            
            # Get the content type
            content_type = self.headers.get('Content-Type')
            
            if content_type != 'text/csv':
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {'error': 'Invalid content type. Expected text/csv'}
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Read the CSV data
            content_length = int(self.headers['Content-Length'])
            csv_data = self.rfile.read(content_length)
            
            # Create directory for uploaded files
            os.makedirs('uploaded_files', exist_ok=True)
            
            # Generate a filename based on timestamp
            import time
            timestamp = int(time.time())
            filename = f'uploaded_files/data_{timestamp}.csv'
            
            # Save the data
            with open(filename, 'wb') as f:
                f.write(csv_data)
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                'message': 'Data uploaded successfully',
                'filename': filename,
                'bytes': len(csv_data)
            }
            self.wfile.write(json.dumps(response).encode())
            
            print(f"Received upload: {filename} ({len(csv_data)} bytes)")
            
        else:
            # Unknown endpoint
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'error': 'Endpoint not found'}
            self.wfile.write(json.dumps(response).encode())

    def do_GET(self):
        # Simple health check endpoint
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'status': 'ok', 'service': 'Wilo-Cloud-Monitoring Backend Simulation'}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {'error': 'Endpoint not found'}
            self.wfile.write(json.dumps(response).encode())

def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, UploadHandler)
    print(f"Starting backend simulation server on port {port}...")
    print(f"Upload endpoint: http://localhost:{port}/api/data")
    print(f"Health check endpoint: http://localhost:{port}/health")
    print("Press Ctrl+C to stop the server")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()