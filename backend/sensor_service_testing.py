#!/usr/bin/env python3
"""
TEMPORARY TESTING VERSION - High-speed MPU6050 sensor data collection service.
This version includes simulation logic for TESTING PURPOSES ONLY.

For production use, use sensor_service.py which requires a real sensor.

Collects sensor readings at 800 Hz, saves to CSV files per second,
and manages aggregation of data every 2 hours.
"""

import os
import time
import json
import csv
import math
from datetime import datetime, timedelta
from pathlib import Path
from collections import deque
import threading
from typing import List, Dict, Tuple

try:
    from mpu6050 import mpu6050
    MPU6050_AVAILABLE = True
except ImportError:
    MPU6050_AVAILABLE = False
    print("Warning: mpu6050 module not available. Using simulated data.")

class SensorService:
    def __init__(self, config_path: str = "config.json", use_simulation: bool = False):
        """Initialize the sensor service with configuration."""
        self.config = self._load_config(config_path)
        self.sampling_rate = self.config["sensor"]["sampling_rate"]
        self.sample_interval = 1.0 / self.sampling_rate
        self.readings_dir = self.config["csv"]["readings_directory"]
        self.aggregate_filename = self.config["csv"]["aggregate_filename"]
        self.max_reading_filename = self.config["csv"]["max_reading_filename"]
        self.aggregation_interval = self.config["processing"]["aggregation_interval_hours"]
        self.use_simulation = use_simulation
        
        # Create readings directory if it doesn't exist
        Path(self.readings_dir).mkdir(parents=True, exist_ok=True)
        
        # Data buffers
        self.current_buffer = deque()
        self.buffer_lock = threading.Lock()
        
        # Sensor connection
        self.sensor = None
        if not self.use_simulation:
            self._connect_sensor()
        
        # Aggregation tracking
        self.last_aggregation = datetime.now()
        
    def _load_config(self, config_path: str) -> dict:
        """Load configuration from JSON file."""
        with open(config_path, 'r') as f:
            return json.load(f)
    
    def _connect_sensor(self):
        """Connect to the MPU6050 sensor."""
        if not MPU6050_AVAILABLE:
            print("Warning: mpu6050 module not available. Using simulated data.")
            self.use_simulation = True
            return
            
        try:
            i2c_address = int(self.config["sensor"]["i2c_address"], 16)
            self.sensor = mpu6050(i2c_address)
            print(f"Connected to MPU6050 sensor at address 0x{self.config['sensor']['i2c_address']}")
        except Exception as e:
            print(f"Failed to connect to sensor: {e}")
            print("Using simulated sensor data for TESTING purposes.")
            self.use_simulation = True
    
    def _get_sensor_data(self) -> Dict[str, float]:
        """Get acceleration data from sensor or simulate if not available."""
        if not self.use_simulation and self.sensor and MPU6050_AVAILABLE:
            try:
                accel_data = self.sensor.get_accel_data()
                # Calculate total acceleration magnitude
                total = math.sqrt(
                    accel_data['x']**2 + 
                    accel_data['y']**2 + 
                    accel_data['z']**2
                )
                return {
                    'x': accel_data['x'],
                    'y': accel_data['y'],
                    'z': accel_data['z'],
                    'total': total
                }
            except Exception as e:
                print(f"Error reading sensor: {e}")
                print("Switching to simulated data for TESTING purposes.")
                self.use_simulation = True
        
        # Simulated data
        t = time.time()
        return {
            'x': math.sin(t) * 9.8,
            'y': math.cos(t) * 9.8,
            'z': math.sin(t * 0.5) * 9.8,
            'total': 9.8
        }
    
    def _get_current_filename(self) -> str:
        """Generate filename based on current timestamp."""
        now = datetime.now()
        # Create directory structure: readings/YYYY/MM/DD/HH/
        dir_path = Path(self.readings_dir) / now.strftime("%Y/%m/%d/%H")
        dir_path.mkdir(parents=True, exist_ok=True)
        
        # Filename format: MMSS.csv (minute and second)
        filename = now.strftime("%M%S.csv")
        return str(dir_path / filename)
    
    def _save_buffer_to_csv(self, filename: str, buffer: List[Dict]):
        """Save buffer data to CSV file."""
        file_exists = os.path.exists(filename)
        
        with open(filename, 'a', newline='') as csvfile:
            fieldnames = ['timestamp', 'x', 'y', 'z', 'total']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            # Write header if file is new
            if not file_exists:
                writer.writeheader()
            
            # Write data rows
            for row in buffer:
                writer.writerow(row)
    
    def _aggregate_data(self):
        """Aggregate data from the last 2 hours and find maximum reading."""
        print("Starting data aggregation...")
        
        # Calculate time window (last 2 hours)
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=self.aggregation_interval)
        
        # Find all CSV files in the time window
        csv_files = []
        for root, dirs, files in os.walk(self.readings_dir):
            for file in files:
                if file.endswith('.csv'):
                    file_path = os.path.join(root, file)
                    # Extract timestamp from file path
                    try:
                        # Parse: readings/YYYY/MM/DD/HH/MMSS.csv
                        path_parts = file_path.split(os.sep)
                        if len(path_parts) >= 6:
                            hour_part = path_parts[-2]  # HH
                            minute_part = path_parts[-1][:2]  # MM from MMSS.csv
                            day_part = path_parts[-3]
                            month_part = path_parts[-4]
                            year_part = path_parts[-5]
                            
                            file_time = datetime(
                                year=int(year_part),
                                month=int(month_part),
                                day=int(day_part),
                                hour=int(hour_part),
                                minute=int(minute_part)
                            )
                            
                            if start_time <= file_time <= end_time:
                                csv_files.append(file_path)
                    except Exception as e:
                        print(f"Error parsing file timestamp {file_path}: {e}")
        
        print(f"Found {len(csv_files)} files in the last {self.aggregation_interval} hours")
        
        if not csv_files:
            print("No files to aggregate.")
            return
        
        # Aggregate all data
        all_data = []
        max_reading = None
        max_reading_file = None
        
        for file_path in csv_files:
            try:
                with open(file_path, 'r') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        all_data.append(row)
                        
                        # Check for maximum reading
                        total_accel = float(row['total'])
                        if max_reading is None or total_accel > max_reading:
                            max_reading = total_accel
                            max_reading_file = file_path
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
        
        # Save aggregated data
        agg_file_path = Path(self.readings_dir) / self.aggregate_filename
        with open(agg_file_path, 'w', newline='') as csvfile:
            if all_data:
                fieldnames = all_data[0].keys()
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(all_data)
        
        # Save maximum reading
        max_file_path = Path(self.readings_dir) / self.max_reading_filename
        with open(max_file_path, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(['max_acceleration', 'source_file'])
            writer.writerow([max_reading, max_reading_file])
        
        print(f"Aggregated {len(all_data)} readings into {agg_file_path}")
        print(f"Maximum reading: {max_reading} from {max_reading_file}")
    
    def collect_data(self):
        """Main data collection loop."""
        mode = "SIMULATED" if self.use_simulation else "REAL SENSOR"
        print(f"Starting sensor data collection at {self.sampling_rate} Hz ({mode})")
        print(f"Saving to directory: {self.readings_dir}")
        
        current_filename = self._get_current_filename()
        samples_count = 0
        second_start = time.time()
        
        try:
            while True:
                loop_start = time.time()
                
                # Get sensor data
                accel_data = self._get_sensor_data()
                
                # Add timestamp
                timestamp = datetime.now().isoformat()
                data_row = {
                    'timestamp': timestamp,
                    **accel_data
                }
                
                # Add to current buffer
                with self.buffer_lock:
                    self.current_buffer.append(data_row)
                
                samples_count += 1
                
                # Check if we need to save the buffer (every second)
                if samples_count >= self.sampling_rate:
                    # Save current buffer to file
                    with self.buffer_lock:
                        buffer_copy = list(self.current_buffer)
                        self.current_buffer.clear()
                    
                    self._save_buffer_to_csv(current_filename, buffer_copy)
                    print(f"Saved {len(buffer_copy)} samples to {current_filename}")
                    
                    # Update for next second
                    current_filename = self._get_current_filename()
                    samples_count = 0
                    second_start = time.time()
                    
                    # Check if it's time for aggregation (every 2 hours)
                    if datetime.now() - self.last_aggregation >= timedelta(hours=self.aggregation_interval):
                        self._aggregate_data()
                        self.last_aggregation = datetime.now()
                
                # Maintain precise timing
                elapsed = time.time() - loop_start
                sleep_time = self.sample_interval - elapsed
                
                if sleep_time > 0:
                    if sleep_time > 0.0005:  # 0.5ms
                        time.sleep(sleep_time)
                    else:
                        # Busy wait for high precision
                        target_time = loop_start + self.sample_interval
                        while time.time() < target_time:
                            pass
                
        except KeyboardInterrupt:
            print("\nStopping sensor data collection...")
            # Save any remaining data
            if len(self.current_buffer) > 0:
                with self.buffer_lock:
                    buffer_copy = list(self.current_buffer)
                    self.current_buffer.clear()
                self._save_buffer_to_csv(current_filename, buffer_copy)
                print(f"Saved final {len(buffer_copy)} samples to {current_filename}")

if __name__ == "__main__":
    # This version defaults to using simulation for testing
    service = SensorService(use_simulation=True)
    service.collect_data()