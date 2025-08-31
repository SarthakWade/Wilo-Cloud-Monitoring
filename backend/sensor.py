#!/usr/bin/env python3
"""
High-speed sensor data collector - 800Hz sampling with minute-wise JSON storage.
"""

import time
import json
import os
import signal
import sys
from datetime import datetime, timedelta
from mpu6050 import mpu6050
from pathlib import Path

class HighSpeedSensorCollector:
    def __init__(self, sampling_rate=800):
        self.sampling_rate = sampling_rate
        self.sample_interval = 1.0 / sampling_rate  # 0.00125 seconds for 800Hz
        self.mpu = None
        self.data_buffer = []
        self.current_minute = None
        self.sample_count = 0
        self.total_samples = 0
        
        # Create data directory
        self.data_dir = Path("sensor_data")
        self.data_dir.mkdir(exist_ok=True)
        
        print(f"High-Speed MPU6050 Data Collector")
        print(f"Sampling Rate: {sampling_rate} Hz")
        print(f"Sample Interval: {self.sample_interval:.6f} seconds")
        print(f"Data Directory: {self.data_dir.absolute()}")
        print("-" * 60)
    
    def connect_sensor(self):
        """Connect to MPU6050 sensor"""
        try:
            self.mpu = mpu6050(0x68)  # Default I2C address
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor connected!")
            return True
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Connection failed: {e}")
            self.mpu = None
            return False
    
    def create_minute_folder(self, timestamp):
        """Create folder for the current minute"""
        minute_str = timestamp.strftime("%Y%m%d_%H%M")
        folder_path = self.data_dir / minute_str
        folder_path.mkdir(exist_ok=True)
        return folder_path, minute_str
    
    def save_minute_data(self, folder_path, minute_str):
        """Save the current minute's data to JSON file"""
        if not self.data_buffer:
            return
        
        filename = f"{minute_str}_data.json"
        filepath = folder_path / filename
        
        # Prepare data structure
        data_structure = {
            "metadata": {
                "sampling_rate": self.sampling_rate,
                "start_time": self.data_buffer[0]["timestamp"] if self.data_buffer else None,
                "end_time": self.data_buffer[-1]["timestamp"] if self.data_buffer else None,
                "total_samples": len(self.data_buffer),
                "duration_seconds": len(self.data_buffer) / self.sampling_rate if self.data_buffer else 0
            },
            "data": self.data_buffer
        }
        
        # Save to JSON file
        try:
            with open(filepath, 'w') as f:
                json.dump(data_structure, f, indent=2)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Saved {len(self.data_buffer)} samples to {filename}")
            
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Error saving data: {e}")
    
    def collect_data(self):
        """Main data collection loop"""
        try:
            while True:
                current_time = datetime.now()
                current_minute_key = current_time.strftime("%Y%m%d_%H%M")
                
                # Check if we need to start a new minute
                if self.current_minute != current_minute_key:
                    # Save previous minute's data if exists
                    if self.current_minute and self.data_buffer:
                        folder_path, _ = self.create_minute_folder(current_time - timedelta(minutes=1))
                        self.save_minute_data(folder_path, self.current_minute)
                    
                    # Start new minute
                    self.current_minute = current_minute_key
                    self.data_buffer = []
                    self.sample_count = 0
                    
                    folder_path, minute_str = self.create_minute_folder(current_time)
                    print(f"[{current_time.strftime('%H:%M:%S')}] Started new minute: {minute_str}")
                
                # Try to connect if not connected
                if self.mpu is None:
                    if not self.connect_sensor():
                        time.sleep(2)
                        continue
                
                # Collect sensor data
                try:
                    start_time = time.time()
                    
                    accel_data = self.mpu.get_accel_data()
                    x, y, z = accel_data['x'], accel_data['y'], accel_data['z']
                    total = (x**2 + y**2 + z**2)**0.5
                    
                    # Create data point
                    data_point = {
                        "timestamp": current_time.isoformat(),
                        "unix_timestamp": current_time.timestamp(),
                        "x": round(x, 6),
                        "y": round(y, 6),
                        "z": round(z, 6),
                        "total": round(total, 6),
                        "sample_id": self.total_samples
                    }
                    
                    self.data_buffer.append(data_point)
                    self.sample_count += 1
                    self.total_samples += 1
                    
                    # Print status every 100 samples
                    if self.sample_count % 100 == 0:
                        print(f"[{current_time.strftime('%H:%M:%S')}] Samples this minute: {self.sample_count}, Total: {self.total_samples}")
                    
                    # Calculate sleep time to maintain 800Hz
                    elapsed = time.time() - start_time
                    sleep_time = max(0, self.sample_interval - elapsed)
                    
                    if sleep_time > 0:
                        time.sleep(sleep_time)
                    
                except Exception as e:
                    print(f"[{current_time.strftime('%H:%M:%S')}] Read error: {e}")
                    print(f"[{current_time.strftime('%H:%M:%S')}] Attempting reconnection...")
                    self.mpu = None
                    time.sleep(1)
                    continue
                    
        except KeyboardInterrupt:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Stopping data collection...")
            
            # Save final minute's data
            if self.current_minute and self.data_buffer:
                folder_path, _ = self.create_minute_folder(datetime.now())
                self.save_minute_data(folder_path, self.current_minute)
            
            print(f"Total samples collected: {self.total_samples}")
            print("Data collection stopped.")
        
        except Exception as e:
            print(f"Unexpected error: {e}")
        
        finally:
            print("Goodbye!")

def main():
    """Main function"""
    print("MPU6050 High-Speed Data Collector (800Hz)")
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    collector = HighSpeedSensorCollector(sampling_rate=800)
    collector.collect_data()

if __name__ == "__main__":
    main()