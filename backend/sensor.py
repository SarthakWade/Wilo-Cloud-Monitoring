#!/usr/bin/env python3
"""
Simple sensor reading script that prints sensor data and sampling rate to terminal.
Useful for testing sensor connectivity and basic functionality.
"""

import time
import math
import signal
import sys
from datetime import datetime

from mpu6050 import mpu6050

class SimpleSensorReader:
    def __init__(self):
        self.running = True
        self.sample_count = 0
        self.start_time = time.time()
        self.last_print_time = time.time()
        
        # Register signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Try to connect to sensor
        self.sensor = None
        self._connect_sensor()
    
    def _connect_sensor(self):
        """Connect to the MPU6050 sensor."""
        try:
            self.sensor = mpu6050(0x68)
            print("Connected to MPU6050 sensor at address 0x68")
        except Exception as e:
            print(f"Failed to connect to sensor: {e}")
            raise
    
    def _get_sensor_data(self):
        """Get acceleration data from sensor."""
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
            raise
    
    def signal_handler(self, signum, frame):
        """Handle interrupt signals for graceful shutdown."""
        print("\nReceived interrupt signal. Stopping...")
        self.running = False
    
    def print_stats(self):
        """Print sampling rate statistics."""
        current_time = time.time()
        elapsed = current_time - self.start_time
        samples_per_second = self.sample_count / elapsed if elapsed > 0 else 0
        
        print(f"Samples: {self.sample_count}, Elapsed: {elapsed:.2f}s, Rate: {samples_per_second:.2f} Hz")
    
    def run(self):
        """Main loop to read and print sensor data."""
        print("Starting sensor reading... Press Ctrl+C to stop.")
        print("Timestamp              | X       | Y       | Z       | Total   | Rate (Hz)")
        print("-" * 70)
        
        try:
            while self.running:
                # Get sensor data
                data = self._get_sensor_data()
                self.sample_count += 1
                
                # Print data every 100 samples to avoid flooding terminal
                if self.sample_count % 100 == 0:
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    elapsed = time.time() - self.start_time
                    rate = self.sample_count / elapsed if elapsed > 0 else 0
                    
                    print(f"{timestamp} | {data['x']:7.3f} | {data['y']:7.3f} | {data['z']:7.3f} | {data['total']:7.3f} | {rate:7.2f}")
                
                # Print statistics every 5 seconds
                if time.time() - self.last_print_time >= 5.0:
                    self.print_stats()
                    self.last_print_time = time.time()
                
                # Small delay to prevent excessive CPU usage
                # For 800 Hz, we target ~1.25ms per sample
                time.sleep(0.001)
                
        except Exception as e:
            print(f"Error during execution: {e}")
        finally:
            print("\nSensor reading stopped.")
            self.print_stats()