#!/usr/bin/env python3
"""
Simple test script to verify API functionality.
"""

import requests
import json
import time

def test_api():
    """Test the API endpoints"""
    base_url = 'http://localhost:8000'
    
    print("Testing API endpoints...")
    
    # Test health check
    try:
        response = requests.get(f'{base_url}/health')
        print(f"Health check: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
    
    # Test status
    try:
        response = requests.get(f'{base_url}/api/status')
        print(f"Status: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Status check failed: {e}")
    
    # Test files list
    try:
        response = requests.get(f'{base_url}/api/files')
        print(f"Files list: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Files list failed: {e}")
    
    # Test stats
    try:
        response = requests.get(f'{base_url}/api/stats')
        print(f"Stats: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"Stats failed: {e}")

if __name__ == '__main__':
    test_api()