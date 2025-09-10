#!/usr/bin/env python3
"""
High-speed sensor service - collects 800 readings per second (every 1.25ms)
and manages CSV file generation with a maximum of 120 files (2 hours of data)
"""

import time
import asyncio
import threading
from datetime import datetime, timedelta
from mpu6050 import mpu6050
import json
import os
import psutil
from pathlib import Path
import csv
from collections import deque
import shutil

class HighSpeedSensorService:
    def __init__(self, config_file="config.json"):
        # Load configuration
        self.config = self.load_config(config_file)
        
        # Sensor settings
        self.sampling_rate = 800  # Fixed at 800 Hz
        self.sample_interval = 1.0 / self.sampling_rate  # 1.25ms
        
        # Sensor connection
        self.mpu = None
        self.connected = False
        
        # File management
        self.readings_dir = Path(self.config.get('csv', {}).get('readings_directory', 'readings'))
        self.readings_dir.mkdir(exist_ok=True)
        
        # Data buffer for current second
        self.current_buffer = []
        self.buffer_lock = threading.Lock()
        
        # File management - maximum 120 files (2 hours)
        self.max_files = 120
        self.file_queue = deque()  # Keep track of files for aggregation
        
        # Aggregate file
        self.aggregate_file = self.readings_dir / "aggregate_data.csv"
        self.aggregate_data = []  # Store all data points for aggregation
        
        # Control flags
        self.running = False
        self.paused = False
        
        # Statistics
        self.total_samples = 0
        self.samples_this_second = 0
        self.last_second = None
        
        # Thread safety
        self.lock = threading.Lock()
        
        print(f"High-Speed Sensor Service initialized")
        print(f"Sampling rate: {self.sampling_rate} Hz (every {self.sample_interval*1000:.3f}ms)")
        print(f"Maximum files: {self.max_files} (2 hours of data)")
        print(f"Readings directory: {self.readings_dir.absolute()}")
    
    def load_config(self, config_file):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            print(f"Configuration loaded from {config_file}")
            return config
        except FileNotFoundError:
            print(f"Config file {config_file} not found, using defaults")
            return self.get_default_config()
        except json.JSONDecodeError as e:
            print(f"Error parsing config file: {e}")
            return self.get_default_config()
    
    def get_default_config(self):
        """Get default configuration"""
        return {
            "csv": {
                "readings_directory": "readings",
                "retention_days": 365
            }
        }
    
    def connect_sensor(self) -> bool:
        """Connect to MPU6050 sensor with maximum performance settings"""
        try:
            # Initialize with optimized I2C settings
            self.mpu = mpu6050(0x68)  # Default I2C address
            
            # Set maximum performance MPU6050 configuration
            try:
                # Aggressive configuration for maximum speed
                self.mpu.bus.write_byte_data(self.mpu.address, 0x6B, 0)    # PWR_MGMT_1 - wake up, no sleep
                self.mpu.bus.write_byte_data(self.mpu.address, 0x19, 0)    # SMPLRT_DIV = 0 (1kHz internal rate)
                self.mpu.bus.write_byte_data(self.mpu.address, 0x1A, 0)    # CONFIG - DLPF disabled for max bandwidth
                self.mpu.bus.write_byte_data(self.mpu.address, 0x1B, 0x00) # GYRO_CONFIG - +/- 250°/s, no self-test
                self.mpu.bus.write_byte_data(self.mpu.address, 0x1C, 0x00) # ACCEL_CONFIG - +/- 2g, no self-test
                self.mpu.bus.write_byte_data(self.mpu.address, 0x6C, 0)    # PWR_MGMT_2 - no standby
                
                # Pre-cache register addresses for faster access
                self.accel_x_reg = 0x3B
                self.accel_y_reg = 0x3D
                self.accel_z_reg = 0x3F
                
                # Test read to verify connection and warm up I2C
                test_data = self.mpu.get_accel_data()
                
                self.connected = True
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor connected with maximum performance settings")
                print(f"Initial test reading: X={test_data['x']:.2f}, Y={test_data['y']:.2f}, Z={test_data['z']:.2f}")
                return True
                
            except Exception as config_error:
                print(f"Warning: Could not set aggressive MPU6050 settings: {config_error}")
                # Fall back to default settings
                self.connected = True
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor connected with default settings")
                return True
                
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor connection failed: {e}")
            self.mpu = None
            self.connected = False
            return False
    
    def disconnect_sensor(self):
        """Disconnect sensor"""
        self.mpu = None
        self.connected = False
        print("Sensor disconnected")
    
    def get_status(self) -> dict:
        """Get current service status"""
        return {
            'connected': self.connected,
            'running': self.running,
            'paused': self.paused,
            'sampling_rate': self.sampling_rate,
            'total_samples': self.total_samples,
            'samples_this_second': self.samples_this_second,
            'csv_stats': self.get_file_stats()
        }
    
    def start(self):
        """Start the sensor service with maximum priority"""
        if self.running:
            print("Service is already running")
            return
        
        self.running = True
        self.paused = False
        
        print("Starting high-performance sensor service...")
        print(f"Target: {self.sampling_rate} Hz sampling rate")
        
        # Set maximum process priority for sensor thread
        try:
            # Set high priority (requires no sudo for small increases)
            os.nice(-5)  # Increase priority (negative = higher priority)
            print("Process priority optimized")
        except PermissionError:
            print("Could not set high priority (requires root)")
        
        # Set CPU affinity to dedicate a core (if possible)
        try:
            process = psutil.Process()
            # Pin to CPU core 3 (usually least used on Pi 4)
            process.cpu_affinity([3])
            print("CPU affinity set to core 3 for maximum performance")
        except (PermissionError, psutil.NoSuchProcess):
            print("Could not set CPU affinity")
        
        # Start the optimized sensor loop in a separate thread
        self.sensor_thread = threading.Thread(
            target=self._sensor_loop, 
            daemon=True,
            name="HighPerformance-Sensor"
        )
        
        # Set thread priority if possible
        self.sensor_thread.start()
        
        print("High-performance sensor service started")
    
    def stop(self):
        """Stop the sensor service"""
        if not self.running:
            print("Service is not running")
            return
        
        print("Stopping sensor service...")
        self.running = False
        
        # Wait for thread to finish
        if hasattr(self, 'sensor_thread'):
            self.sensor_thread.join(timeout=2)
        
        # Save any remaining data and cleanup
        self._save_current_buffer()
        self._update_aggregate_file()
        
        print("Sensor service stopped")
    
    def pause(self):
        """Pause data collection"""
        self.paused = True
        print("Data collection paused")
    
    def resume(self):
        """Resume data collection"""
        self.paused = False
        print("Data collection resumed")
    
    def _format_ms(self, ms_value: float) -> str:
        """Format milliseconds with up to 4 decimal places and 'ms' suffix"""
        s = f"{ms_value:.4f}".rstrip('0').rstrip('.')
        return f"{s}ms"
    
    def _save_current_buffer(self):
        """Save the current buffer to a CSV file"""
        if not self.current_buffer or len(self.current_buffer) == 0:
            return
            
        current_second = datetime.now().replace(microsecond=0)
        
        # Create hierarchical folder structure: readings/YYYY/MM/Week_N/DD/
        year = current_second.strftime("%Y")
        month = current_second.strftime("%m")
        day = current_second.strftime("%d")
        
        # Calculate week number within the month
        week_num = ((current_second.day - 1) // 7) + 1
        week_folder = f"Week_{week_num}"
        
        # Create folder structure
        folder_path = self.readings_dir / year / month / week_folder / day
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename: HHMMSS.csv (since date is in folder structure)
        filename = current_second.strftime("%H%M%S.csv")
        filepath = folder_path / filename
        
        try:
            with open(filepath, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write header
                writer.writerow(['Time (ms)', 'Acceleration'])
                
                # Write data
                for sample in self.current_buffer:
                    writer.writerow([sample['time_ms'], sample['acceleration']])
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(self.current_buffer)} samples to {filename}")
            
            # Add to file queue for aggregation
            self.file_queue.append(filepath)
            
            # Add data to aggregate collection
            self.aggregate_data.extend(self.current_buffer)
            
            # Maintain maximum file count (120 files = 2 hours)
            if len(self.file_queue) > self.max_files:
                # Remove oldest file
                oldest_file = self.file_queue.popleft()
                if oldest_file.exists():
                    try:
                        oldest_file.unlink()
                        print(f"Removed oldest file: {oldest_file}")
                    except Exception as e:
                        print(f"Error removing oldest file: {e}")
                
                # Remove corresponding data from aggregate (keep only data from last 120 files)
                if len(self.aggregate_data) > self.max_files * self.sampling_rate:
                    # Remove oldest data points
                    points_to_remove = len(self.aggregate_data) - (self.max_files * self.sampling_rate)
                    self.aggregate_data = self.aggregate_data[points_to_remove:]
            
            # Update aggregate file
            self._update_aggregate_file()
            
        except Exception as e:
            print(f"Error saving CSV file {filename}: {e}")
        
        # Clear buffer
        self.current_buffer = []
    
    def _update_aggregate_file(self):
        """Update the aggregate CSV file with all current data"""
        try:
            # Create temporary file first
            temp_file = self.aggregate_file.with_suffix('.tmp')
            
            with open(temp_file, 'w', newline='') as csvfile:
                writer = csv.writer(csvfile)
                
                # Write header
                writer.writerow(['Time (ms)', 'Acceleration'])
                
                # Write all aggregated data
                for sample in self.aggregate_data:
                    writer.writerow([sample['time_ms'], sample['acceleration']])
            
            # Atomically replace the aggregate file
            temp_file.replace(self.aggregate_file)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Updated aggregate file with {len(self.aggregate_data)} samples")
            
        except Exception as e:
            print(f"Error updating aggregate file: {e}")
    
    def _sensor_loop(self):
        """Optimized sensor loop for high-frequency sampling"""
        print(f"Sensor loop started - Target: {self.sampling_rate} Hz ({self.sample_interval*1000:.3f}ms per sample)")
        
        # Pre-calculate timing constants for maximum performance
        target_interval = self.sample_interval
        samples_per_status = self.sampling_rate
        
        # Pre-allocate variables to avoid repeated allocation
        sample_count = 0
        last_status_time = time.perf_counter()
        last_second_boundary = None
        samples_this_second = 0
        current_second_key = None
        
        # Optimization: pre-import needed functions
        perf_counter = time.perf_counter
        datetime_now = datetime.now
        
        print(f"Target interval: {target_interval*1000:.3f}ms per sample")
        
        # Initialize second tracking
        current_time = datetime_now()
        current_second_key = current_time.replace(microsecond=0)
        
        while self.running:
            if self.paused:
                time.sleep(0.001)
                continue
            
            # Fast connection check
            if not self.connected:
                if not self.connect_sensor():
                    time.sleep(0.1)
                    continue
            
            try:
                # High precision timing start
                loop_start = perf_counter()
                
                # Get timestamp once and reuse
                current_time = datetime_now()
                
                # Check if we've crossed a second boundary
                new_second_key = current_time.replace(microsecond=0)
                if new_second_key != current_second_key:
                    # Save previous second's data
                    with self.buffer_lock:
                        self._save_current_buffer()
                    
                    # Update second tracking
                    current_second_key = new_second_key
                    samples_this_second = 0
                
                # Optimized sensor read - direct I2C access
                try:
                    # Read all 6 bytes in one I2C transaction (most efficient)
                    raw_data = self.mpu.bus.read_i2c_block_data(self.mpu.address, 0x3B, 6)
                    
                    # Fast data conversion - avoid float operations where possible
                    accel_x = (raw_data[0] << 8 | raw_data[1])
                    if accel_x > 32767: accel_x -= 65536
                    accel_y = (raw_data[2] << 8 | raw_data[3])
                    if accel_y > 32767: accel_y -= 65536
                    accel_z = (raw_data[4] << 8 | raw_data[5])
                    if accel_z > 32767: accel_z -= 65536
                    
                    # Convert to g-force (MPU6050 sensitivity: 16384 LSB/g for ±2g range)
                    x = accel_x / 16384.0
                    y = accel_y / 16384.0
                    z = accel_z / 16384.0
                    
                except Exception:
                    # Fallback to library method if direct access fails
                    accel_data = self.mpu.get_accel_data()
                    x, y, z = accel_data['x'], accel_data['y'], accel_data['z']
                
                # Fast magnitude calculation
                acceleration_squared = x*x + y*y + z*z
                acceleration = acceleration_squared ** 0.5
                
                # Add sample to buffer with precise timing
                time_ms = current_time.microsecond / 1000.0
                sample = {
                    'time_ms': self._format_ms(time_ms),
                    'acceleration': round(acceleration, 4)
                }
                
                with self.buffer_lock:
                    self.current_buffer.append(sample)
                
                # Counter updates
                sample_count += 1
                samples_this_second += 1
                self.total_samples += 1
                
                # Update status infrequently to minimize overhead
                current_perf_time = perf_counter()
                if current_perf_time - last_status_time >= 1.0:
                    if last_second_boundary != current_second_key:
                        if samples_this_second > 0:
                            print(f"[{current_second_key.strftime('%H:%M:%S')}] Achieved {samples_this_second} samples/sec (Target: {self.sampling_rate})")
                        last_second_boundary = current_second_key
                    last_status_time = current_perf_time
                
                # Precise timing control
                elapsed = perf_counter() - loop_start
                sleep_time = target_interval - elapsed
                
                if sleep_time > 0:
                    if sleep_time > 0.0005:  # 0.5ms threshold for sleep vs busy-wait
                        time.sleep(sleep_time)
                    else:
                        # Aggressive busy-wait for sub-millisecond precision
                        target_time = loop_start + target_interval
                        while perf_counter() < target_time:
                            pass
                else:
                    # Log performance issues less frequently
                    if sample_count % (self.sampling_rate * 10) == 0:
                        behind_ms = (elapsed - target_interval) * 1000
                        achieved_hz = 1.0 / elapsed if elapsed > 0 else 0
                        print(f"Performance: {behind_ms:.1f}ms behind, achieving ~{achieved_hz:.0f} Hz")
                
            except Exception as e:
                print(f"[{datetime_now().strftime('%H:%M:%S')}] Sensor error: {e}")
                self.connected = False
                self.mpu = None
                time.sleep(0.01)
        
        # Save any remaining data when stopping
        with self.buffer_lock:
            self._save_current_buffer()
        
        print("Sensor loop ended")
    
    def get_file_list(self) -> list:
        """Get list of all CSV files in readings directory"""
        try:
            csv_files = []
            for csv_file in self.readings_dir.rglob("*.csv"):
                # Skip the aggregate file
                if csv_file.name == "aggregate_data.csv":
                    continue
                # Get relative path from readings directory
                relative_path = csv_file.relative_to(self.readings_dir)
                csv_files.append(str(relative_path))
            return sorted(csv_files, reverse=True)  # Most recent first
        except Exception as e:
            print(f"Error getting file list: {e}")
            return []
    
    def get_folder_structure(self) -> dict:
        """Get hierarchical folder structure for calendar view"""
        try:
            structure = {}
            
            for csv_file in self.readings_dir.rglob("*.csv"):
                # Skip the aggregate file
                if csv_file.name == "aggregate_data.csv":
                    continue
                    
                relative_path = csv_file.relative_to(self.readings_dir)
                parts = relative_path.parts
                
                if len(parts) >= 4:  # year/month/week/day/file.csv
                    year, month, week, day = parts[:4]
                    filename = parts[-1]
                    
                    # Build nested structure
                    if year not in structure:
                        structure[year] = {}
                    if month not in structure[year]:
                        structure[year][month] = {}
                    if week not in structure[year][month]:
                        structure[year][month][week] = {}
                    if day not in structure[year][month][week]:
                        structure[year][month][week][day] = []
                    
                    structure[year][month][week][day].append({
                        'filename': filename,
                        'path': str(relative_path),
                        'size': csv_file.stat().st_size,
                        'modified': csv_file.stat().st_mtime
                    })
            
            return structure
        except Exception as e:
            print(f"Error getting folder structure: {e}")
            return {}
    
    def get_latest_file(self) -> str:
        """Get the most recent CSV file"""
        files = self.get_file_list()
        return files[0] if files else None
    
    def get_file_stats(self) -> dict:
        """Get statistics about CSV files"""
        files = self.get_file_list()
        total_size = 0
        
        try:
            for filename in files:
                filepath = self.readings_dir / filename
                if filepath.exists():
                    total_size += filepath.stat().st_size
            
            return {
                'total_files': len(files),
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'latest_file': files[0] if files else None,
                'oldest_file': files[-1] if files else None
            }
        except Exception as e:
            print(f"Error getting file stats: {e}")
            return {'total_files': 0, 'total_size_mb': 0}
    
    def load_csv_data(self, filename: str) -> list:
        """Load CSV data from file"""
        # Find the CSV file in the hierarchical structure
        csv_path = None
        
        # Search in the readings directory structure
        for csv_file in self.readings_dir.rglob("*.csv"):
            if csv_file.name == filename or str(csv_file.relative_to(self.readings_dir)) == filename:
                csv_path = csv_file
                break
        
        if not csv_path or not csv_path.exists():
            raise FileNotFoundError(f"CSV file {filename} not found")
        
        # Read CSV data
        data_points = []
        try:
            with open(csv_path, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                # Derive base datetime from folder structure and filename (HHMMSS.csv)
                try:
                    rel = csv_path.relative_to(self.readings_dir)
                    parts = rel.parts
                    # Expected: year/month/week/day/file.csv
                    year = int(parts[0])
                    month = int(parts[1])
                    day = int(parts[3])
                    file_name = parts[-1]
                    time_str = file_name.replace('.csv', '')
                    hour = int(time_str[0:2])
                    minute = int(time_str[2:4])
                    second = int(time_str[4:6])
                    base_dt = datetime(year, month, day, hour, minute, second)
                except Exception:
                    base_dt = None

                for row in reader:
                    # Support both headers
                    if 'Time (ms)' in row and row['Time (ms)'] and base_dt is not None:
                        # Parse like '3.2122ms' → add to base_dt
                        raw = row['Time (ms)'].strip()
                        if raw.endswith('ms'):
                            raw = raw[:-2]
                        try:
                            ms = float(raw)
                        except ValueError:
                            ms = 0.0
                        ts = (base_dt if base_dt else datetime.now())
                        ts = ts.timestamp() + (ms / 1000.0)
                        iso_ts = datetime.fromtimestamp(ts).isoformat()
                        data_points.append({
                            'timestamp': iso_ts,
                            'acceleration': float(row['Acceleration'])
                        })
                    elif 'Timestamp' in row and row['Timestamp']:
                        data_points.append({
                            'timestamp': row['Timestamp'],
                            'acceleration': float(row['Acceleration'])
                        })
            
            # Limit to last 1000 points for performance
            return data_points[-1000:] if len(data_points) > 1000 else data_points
            
        except Exception as e:
            raise Exception(f"Error reading CSV file: {str(e)}")

def main():
    """Main function for testing"""
    service = HighSpeedSensorService()
    
    try:
        service.start()
        
        # Let it run for a few seconds
        time.sleep(10)
        
        # Show status
        status = service.get_status()
        print(f"\nService Status:")
        print(json.dumps(status, indent=2))
        
    except KeyboardInterrupt:
        print("\nStopping service...")
    finally:
        service.stop()

if __name__ == "__main__":
    main()