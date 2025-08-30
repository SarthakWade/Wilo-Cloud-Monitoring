#!/usr/bin/env python3
"""
Test script to verify that both backend API and frontend are working correctly.
"""

import requests
import time
import subprocess
import os

def test_backend_api():
    """Test if the backend API is working"""
    try:
        # Test health check endpoint
        response = requests.get('http://localhost:8000/health')
        if response.status_code == 200:
            print("✅ Backend API health check: PASSED")
            print(f"   Response: {response.json()}")
        else:
            print("❌ Backend API health check: FAILED")
            return False
            
        # Test status endpoint
        response = requests.get('http://localhost:8000/api/status')
        if response.status_code == 200:
            print("✅ Backend API status endpoint: PASSED")
            print(f"   Response: {response.json()}")
        else:
            print("❌ Backend API status endpoint: FAILED")
            return False
            
        # Test files endpoint
        response = requests.get('http://localhost:8000/api/files')
        if response.status_code == 200:
            print("✅ Backend API files endpoint: PASSED")
            files_data = response.json()
            print(f"   Found {files_data.get('count', 0)} files")
            return True
        else:
            print("❌ Backend API files endpoint: FAILED")
            return False
            
    except Exception as e:
        print(f"❌ Backend API test: FAILED with exception: {e}")
        return False

def test_frontend_access():
    """Test if we can access the frontend"""
    try:
        # Test if we can access the frontend
        response = requests.get('http://localhost:3000')
        if response.status_code == 200:
            print("✅ Frontend access: PASSED")
            return True
        else:
            print("❌ Frontend access: FAILED")
            return False
    except Exception as e:
        print(f"❌ Frontend access: FAILED with exception: {e}")
        return False

def test_data_sync():
    """Test if data sync is working"""
    try:
        # Test if we can access a data file through the frontend
        response = requests.get('http://localhost:3000/data/2025-08-30_01-26-06.json')
        if response.status_code == 200:
            data = response.json()
            if 'readings' in data:
                print("✅ Data sync test: PASSED")
                print(f"   File contains {len(data['readings'])} readings")
                return True
            else:
                print("❌ Data sync test: FAILED - Invalid data format")
                return False
        else:
            print("❌ Data sync test: FAILED - Cannot access data file")
            return False
    except Exception as e:
        print(f"❌ Data sync test: FAILED with exception: {e}")
        return False

def main():
    print("🚀 Testing Wilo-Cloud-Monitoring System")
    print("=" * 50)
    
    # Test backend API
    backend_ok = test_backend_api()
    print()
    
    # Test frontend access
    frontend_ok = test_frontend_access()
    print()
    
    # Test data sync
    data_ok = test_data_sync()
    print()
    
    # Summary
    print("=" * 50)
    if backend_ok and frontend_ok and data_ok:
        print("🎉 All tests PASSED! The system is working correctly.")
        return True
    else:
        print("💥 Some tests FAILED. Please check the system.")
        return False

if __name__ == "__main__":
    main()