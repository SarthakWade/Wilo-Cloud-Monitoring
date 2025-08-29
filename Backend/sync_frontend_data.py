#!/usr/bin/env python3
"""
Script to sync data from backend CSV files to frontend JSON files.
Converts CSV sensor data files to JSON format expected by the Next.js frontend.
"""

import os
import json
import csv
from datetime import datetime

def convert_csv_to_json(csv_filepath, json_filepath):
    """
    Convert a CSV file to JSON format expected by the frontend.
    
    Args:
        csv_filepath (str): Path to the input CSV file
        json_filepath (str): Path to the output JSON file
    """
    try:
        # Read CSV file
        with open(csv_filepath, 'r') as csvfile:
            reader = csv.DictReader(csvfile)
            readings = []
            
            for row in reader:
                # Convert to the format expected by the frontend
                if 'timestamp' in row and 'acceleration' in row:
                    try:
                        acceleration = int(row['acceleration'])
                    except ValueError:
                        acceleration = 0
                    
                    readings.append({
                        'timestamp': row['timestamp'],
                        'acceleration': acceleration
                    })
        
        # Write JSON file
        with open(json_filepath, 'w') as jsonfile:
            json.dump({'readings': readings}, jsonfile, indent=2)
        
        print(f"Converted {csv_filepath} to {json_filepath}")
        return True
        
    except Exception as e:
        print(f"Error converting {csv_filepath}: {e}")
        return False

def sync_data_to_frontend(backend_dir='readings', frontend_dir='../Frontend/public/data'):
    """
    Sync all CSV files from backend to JSON files in frontend.
    
    Args:
        backend_dir (str): Path to backend readings directory
        frontend_dir (str): Path to frontend public/data directory
    """
    # Create frontend data directory if it doesn't exist
    if not os.path.exists(frontend_dir):
        os.makedirs(frontend_dir)
        print(f"Created directory: {frontend_dir}")
    
    # Get list of CSV files from backend
    if not os.path.exists(backend_dir):
        print(f"Backend directory {backend_dir} does not exist")
        return
    
    csv_files = [f for f in os.listdir(backend_dir) if f.endswith('.csv')]
    
    if not csv_files:
        print("No CSV files found in backend directory")
        return
    
    # Sort by modification time, newest first
    csv_files.sort(key=lambda x: os.path.getmtime(os.path.join(backend_dir, x)), reverse=True)
    
    # Convert up to 5 most recent files (matching frontend expectation)
    for i, csv_file in enumerate(csv_files[:5]):
        csv_filepath = os.path.join(backend_dir, csv_file)
        
        # Convert filename to match frontend naming convention
        # Backend: sensor_data_20250830_010025.csv
        # Frontend: 2025-08-13_19-32-54.json
        try:
            # Extract date and time from backend filename
            parts = csv_file.replace('sensor_data_', '').replace('.csv', '').split('_')
            date_part = parts[0]  # 20250830
            time_part = parts[1]  # 010025
            
            # Convert to frontend format
            # 20250830 -> 2025-08-30
            formatted_date = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:]}"
            # 010025 -> 01-00-25
            formatted_time = f"{time_part[:2]}-{time_part[2:4]}-{time_part[4:]}"
            
            # Frontend naming convention
            json_filename = f"{formatted_date}_{formatted_time}.json"
        except:
            # Fallback to simple conversion
            json_filename = csv_file.replace('.csv', '.json')
        
        json_filepath = os.path.join(frontend_dir, json_filename)
        
        # Convert CSV to JSON
        if convert_csv_to_json(csv_filepath, json_filepath):
            print(f"Synced {csv_file} -> {json_filename}")
    
    print(f"Synced {min(len(csv_files), 5)} files to frontend")

if __name__ == "__main__":
    sync_data_to_frontend()