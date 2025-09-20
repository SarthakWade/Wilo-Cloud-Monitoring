#!/usr/bin/env python3
"""
Simple sensor reading script that collects data at 800 Hz and saves to CSV files.
Every second, a new CSV file is created.
Periodically aggregates data and finds maximum value.
"""

import time
import math
import signal
import json
import csv
import os
from datetime import datetime, timedelta
from pathlib import Path
from collections import deque

from mpu6050 import mpu6050

class SensorReader:
    def __init__(self):
        self.running = True
        self.sample_count = 0
        self.start_time = time.perf_counter()
        self.current_buffer = deque()
        
        # Load configuration
        self.config = self._load_config()
        self.sampling_rate = 800  # Hardcoded as requested
        self.sample_interval = 1.0 / self.sampling_rate
        self.readings_dir = self.config["csv"]["readings_directory"]
        self.aggregate_output_dir = self.config["csv"]["aggregate_output_directory"]
        self.aggregate_filename_prefix = self.config["csv"]["aggregate_filename_prefix"]
        self.max_reading_filename_prefix = self.config["csv"]["max_reading_filename_prefix"]
        self.aggregation_interval_seconds = self.config["processing"]["aggregation_interval_seconds"]
        
        # Create directories if they don't exist
        Path(self.readings_dir).mkdir(parents=True, exist_ok=True)
        Path(self.aggregate_output_dir).mkdir(parents=True, exist_ok=True)
        
        # Register signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Connect to sensor
        self.sensor = None
        self._connect_sensor()
        
        # Tracking for aggregation
        self.last_aggregation = 0
        self.files_since_last_aggregation = 0  # Track number of files saved since last aggregation
        
    def _load_config(self):
        """Load configuration from JSON file."""
        with open('config.json', 'r') as f:
            return json.load(f)
    
    def _connect_sensor(self):
        """Connect to the MPU6050 sensor."""
        try:
            i2c_address = int(self.config["sensor"]["i2c_address"], 16)
            self.sensor = mpu6050(i2c_address)
            print(f"Connected to MPU6050 sensor at address 0x{self.config['sensor']['i2c_address']}")
        except Exception as e:
            print(f"Failed to connect to sensor: {e}")
            raise
    
    def _get_sensor_data(self):
        """Get acceleration data from sensor using optimized direct access."""
        try:
            # Direct I2C register access for faster reading
            raw_data = self.sensor.bus.read_i2c_block_data(
                self.sensor.address, 
                self.sensor.ACCEL_XOUT0, 
                6
            )
            
            # Convert raw data to acceleration values
            accel_x = (raw_data[0] << 8) | raw_data[1]
            accel_y = (raw_data[2] << 8) | raw_data[3]
            accel_z = (raw_data[4] << 8) | raw_data[5]
            
            # Handle two's complement
            if accel_x > 32767:
                accel_x -= 65536
            if accel_y > 32767:
                accel_y -= 65536
            if accel_z > 32767:
                accel_z -= 65536
            
            # Convert to m/s² (using 2G range scale modifier)
            accel_x = accel_x / self.sensor.ACCEL_SCALE_MODIFIER_2G * self.sensor.GRAVITIY_MS2
            accel_y = accel_y / self.sensor.ACCEL_SCALE_MODIFIER_2G * self.sensor.GRAVITIY_MS2
            accel_z = accel_z / self.sensor.ACCEL_SCALE_MODIFIER_2G * self.sensor.GRAVITIY_MS2
            
            # Calculate total acceleration magnitude
            total = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)
            
            return {
                'x': accel_x,
                'y': accel_y,
                'z': accel_z,
                'total': total
            }
        except Exception as e:
            print(f"Error reading sensor: {e}")
            raise
    
    def _get_current_filename(self):
        """Generate filename based on current timestamp."""
        now = datetime.now()
        # Create directory structure: readings/YYYY/MM/DD/HH/
        dir_path = Path(self.readings_dir) / now.strftime("%Y/%m/%d/%H")
        dir_path.mkdir(parents=True, exist_ok=True)
        
        # Filename format: MMSS.csv (minute and second)
        filename = now.strftime("%M%S.csv")
        return str(dir_path / filename)
    
    def _save_buffer_to_csv(self, filename, buffer):
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
        """Find and copy the file with maximum reading for the last aggregation interval."""
        print("Starting max reading file creation...")
        
        # For file-based aggregation, we'll look for the most recent N files
        # where N = aggregation_interval_seconds
        all_csv_files = []
        for root, dirs, files in os.walk(self.readings_dir):
            for file in files:
                if file.endswith('.csv'):
                    file_path = os.path.join(root, file)
                    all_csv_files.append(file_path)
        
        # Sort files by modification time (newest first)
        all_csv_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        
        # Take the most recent N files (where N = aggregation_interval_seconds)
        csv_files = all_csv_files[:self.aggregation_interval_seconds]
        
        # Sort files by timestamp to ensure proper order
        csv_files.sort()
        
        print(f"Found {len(csv_files)} files for max reading analysis")
        
        if not csv_files:
            print("No files to analyze.")
            return
        
        # Calculate time window for filename
        # Get timestamps from the first and last files
        first_file = csv_files[0]
        last_file = csv_files[-1]
        
        # Extract timestamps from file paths
        try:
            # Parse first file timestamp
            first_path_parts = first_file.split(os.sep)
            first_hour = first_path_parts[-2]
            first_minute_second = first_path_parts[-1].replace('.csv', '')
            first_minute = first_minute_second[:2]
            first_second = first_minute_second[2:4]
            
            # Parse last file timestamp
            last_path_parts = last_file.split(os.sep)
            last_hour = last_path_parts[-2]
            last_minute_second = last_path_parts[-1].replace('.csv', '')
            last_minute = last_minute_second[:2]
            last_second = last_minute_second[2:4]
            
            # Create datetime objects
            first_time = datetime.now().replace(
                hour=int(first_hour), 
                minute=int(first_minute), 
                second=int(first_second), 
                microsecond=0
            )
            last_time = datetime.now().replace(
                hour=int(last_hour), 
                minute=int(last_minute), 
                second=int(last_second), 
                microsecond=0
            )
            
            # Generate timestamped filenames
            start_timestamp = first_time.strftime("%H:%M:%S")
            end_timestamp = last_time.strftime("%H:%M:%S")
            timestamp_suffix = f"{start_timestamp}_to_{end_timestamp}"
        except Exception as e:
            print(f"Error parsing timestamps: {e}")
            # Fallback to current time
            now = datetime.now()
            start_time = now - timedelta(seconds=self.aggregation_interval_seconds)
            start_timestamp = start_time.strftime("%H:%M:%S")
            end_timestamp = now.strftime("%H:%M:%S")
            timestamp_suffix = f"{start_timestamp}_to_{end_timestamp}"
        
        # Find the file with maximum reading
        max_reading = None
        max_reading_file = None
        
        for file_path in csv_files:
            try:
                with open(file_path, 'r') as csvfile:
                    reader = csv.DictReader(csvfile)
                    for row in reader:
                        # Check for maximum reading
                        total_accel = float(row['total'])
                        if max_reading is None or total_accel > max_reading:
                            max_reading = total_accel
                            max_reading_file = file_path
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
        
        # Save maximum reading file as a copy of the source file with maximum reading
        max_filename = f"{self.max_reading_filename_prefix}{timestamp_suffix}.csv"
        max_file_path = Path(self.aggregate_output_dir) / max_filename
        
        if max_reading_file:
            # Copy the entire contents of the source file that had the maximum reading
            try:
                import shutil
                shutil.copy2(max_reading_file, max_file_path)
                print(f"Copied maximum reading file: {max_reading_file} to {max_file_path}")
            except Exception as e:
                print(f"Error copying maximum reading file: {e}")
                # Fallback to old method if copy fails
                with open(max_file_path, 'w', newline='') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(['max_acceleration', 'source_file'])
                    if max_reading is not None:
                        writer.writerow([max_reading, max_reading_file])
                    else:
                        writer.writerow(['No data', 'No data'])
        else:
            # Fallback to old method if no max reading file found
            with open(max_file_path, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(['max_acceleration', 'source_file'])
                if max_reading is not None:
                    writer.writerow([max_reading, max_reading_file])
                else:
                    writer.writerow(['No data', 'No data'])
        
        if max_reading is not None:
            print(f"Maximum reading: {max_reading} from {max_reading_file}")
        else:
            print("No maximum reading found")
        
        print(f"Created max reading file: {max_filename}")
    
    def signal_handler(self, signum, frame):
        """Handle interrupt signals for graceful shutdown."""
        print("\nReceived interrupt signal. Stopping...")
        self.running = False
    
    def run(self):
        """Main loop to read and save sensor data."""
        print(f"Starting sensor data collection at {self.sampling_rate} Hz")
        print(f"Saving to directory: {self.readings_dir}")
        print(f"Aggregation interval: {self.aggregation_interval_seconds} seconds")
        print("Press Ctrl+C to stop.")
        
        current_filename = self._get_current_filename()
        samples_count = 0
        second_start = time.perf_counter()
        
        try:
            while self.running:
                loop_start = time.perf_counter()
                
                # Get sensor data
                accel_data = self._get_sensor_data()
                
                # Add timestamp
                timestamp = datetime.now().isoformat()
                data_row = {
                    'timestamp': timestamp,
                    **accel_data
                }
                
                # Add to current buffer
                self.current_buffer.append(data_row)
                samples_count += 1
                
                # Check if we need to save the buffer (every second)
                if samples_count >= self.sampling_rate:
                    # Save current buffer to file
                    buffer_copy = list(self.current_buffer)
                    self.current_buffer.clear()
                    
                    self._save_buffer_to_csv(current_filename, buffer_copy)
                    print(f"Saved {len(buffer_copy)} samples to {current_filename}")
                    
                    # Increment file counter for aggregation
                    self.files_since_last_aggregation += 1
                    
                    # Update for next second
                    current_filename = self._get_current_filename()
                    samples_count = 0
                    second_start = time.perf_counter()
                    
                    # Check if it's time for aggregation (every 10 files)
                    if self.files_since_last_aggregation >= self.aggregation_interval_seconds:
                        self._aggregate_data()
                        self.files_since_last_aggregation = 0
                        self.last_aggregation = time.time()
                
                # Maintain precise timing
                loop_end = time.perf_counter()
                elapsed = loop_end - loop_start
                sleep_time = self.sample_interval - elapsed
                
                if sleep_time > 0:
                    if sleep_time > 0.0001:  # 100 microseconds
                        time.sleep(sleep_time)
                    else:
                        # Busy wait for high precision
                        target_time = loop_start + self.sample_interval
                        while time.perf_counter() < target_time:
                            pass
                
        except Exception as e:
            print(f"Error during execution: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\nSensor reading stopped.")
            # Save any remaining data
            if len(self.current_buffer) > 0:
                buffer_copy = list(self.current_buffer)
                self.current_buffer.clear()
                self._save_buffer_to_csv(current_filename, buffer_copy)
                print(f"Saved final {len(buffer_copy)} samples to {current_filename}")

if __name__ == "__main__":
    reader = SensorReader()
    reader.run()