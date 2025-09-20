#!/usr/bin/env python3
"""
High-speed MPU6050 sensor reading script optimized for 800-850 Hz sampling rate.
This script uses direct I2C register access and other optimizations to achieve
maximum sampling rate from the MPU6050 sensor.
"""

import time
import math
import signal
import sys
from datetime import datetime
from collections import deque

from mpu6050 import mpu6050

class HighSpeedSensorReader:
    def __init__(self, target_rate=800):
        self.target_rate = target_rate
        self.target_interval = 1.0 / target_rate if target_rate > 0 else 0
        self.running = True
        self.sample_count = 0
        self.start_time = time.perf_counter()
        self.last_print_time = time.perf_counter()
        self.samples_buffer = deque(maxlen=1000)  # Buffer for performance monitoring
        
        # Register signal handler for graceful shutdown
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Connect to sensor
        self.sensor = None
        self._connect_sensor()
        
        # Configure sensor for high-speed operation
        self._configure_sensor()
    
    def _connect_sensor(self):
        """Connect to the MPU6050 sensor."""
        try:
            self.sensor = mpu6050(0x68)
            print("Connected to MPU6050 sensor at address 0x68")
        except Exception as e:
            print(f"Failed to connect to sensor: {e}")
            raise
    
    def _configure_sensor(self):
        """Configure the MPU6050 for maximum sampling rate."""
        try:
            # Set accelerometer range to 2G for higher sensitivity
            self.sensor.set_accel_range(self.sensor.ACCEL_RANGE_2G)
            
            # Set gyroscope range to 250 deg/s for higher sensitivity
            self.sensor.set_gyro_range(self.sensor.GYRO_RANGE_250DEG)
            
            # Set digital low-pass filter to maximum bandwidth (256 Hz)
            self.sensor.set_filter_range(self.sensor.FILTER_BW_256)
            
            print("Sensor configured for high-speed operation")
        except Exception as e:
            print(f"Warning: Could not configure sensor: {e}")
            print("Using default sensor configuration")
    
    def _get_sensor_data_optimized(self):
        """Get acceleration data using optimized direct register access."""
        try:
            # Direct I2C register access for faster reading
            # Read 6 bytes of accelerometer data starting from ACCEL_XOUT0
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
    
    def signal_handler(self, signum, frame):
        """Handle interrupt signals for graceful shutdown."""
        print("\nReceived interrupt signal. Stopping...")
        self.running = False
    
    def print_stats(self):
        """Print sampling rate statistics."""
        current_time = time.perf_counter()
        elapsed = current_time - self.start_time
        samples_per_second = self.sample_count / elapsed if elapsed > 0 else 0
        
        # Calculate recent performance
        if len(self.samples_buffer) > 1:
            recent_elapsed = self.samples_buffer[-1][0] - self.samples_buffer[0][0]
            recent_samples = len(self.samples_buffer)
            recent_rate = recent_samples / recent_elapsed if recent_elapsed > 0 else 0
        else:
            recent_rate = samples_per_second
        
        print(f"Samples: {self.sample_count}, Elapsed: {elapsed:.2f}s, "
              f"Overall Rate: {samples_per_second:.1f} Hz, "
              f"Recent Rate: {recent_rate:.1f} Hz")
    
    def run(self):
        """Main high-speed loop to read and print sensor data."""
        print(f"Starting high-speed sensor reading at {self.target_rate} Hz... Press Ctrl+C to stop.")
        print("Timestamp              | X       | Y       | Z       | Total   | Rate (Hz)")
        print("-" * 75)
        
        try:
            while self.running:
                loop_start = time.perf_counter()
                
                # Get sensor data using optimized method
                data = self._get_sensor_data_optimized()
                self.sample_count += 1
                
                # Store timing data for performance monitoring
                current_time = time.perf_counter()
                self.samples_buffer.append((current_time, data))
                
                # Print data every 400 samples to avoid flooding terminal
                if self.sample_count % 400 == 0:
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    elapsed = current_time - self.start_time
                    rate = self.sample_count / elapsed if elapsed > 0 else 0
                    
                    print(f"{timestamp} | {data['x']:7.3f} | {data['y']:7.3f} | "
                          f"{data['z']:7.3f} | {data['total']:7.3f} | {rate:7.1f}")
                
                # Print statistics every 3 seconds
                if current_time - self.last_print_time >= 3.0:
                    self.print_stats()
                    self.last_print_time = current_time
                
                # Maintain target sampling rate with precise timing
                if self.target_interval > 0:
                    loop_end = time.perf_counter()
                    elapsed = loop_end - loop_start
                    sleep_time = self.target_interval - elapsed
                    
                    # Only sleep if we have time to spare
                    if sleep_time > 0.0001:  # 100 microseconds
                        time.sleep(sleep_time)
                    # If sleep_time is negative, we're behind schedule - continue without delay
        
        except Exception as e:
            print(f"Error during execution: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\nSensor reading stopped.")
            self.print_stats()

if __name__ == "__main__":
    # Parse command line arguments for target sampling rate
    target_rate = 800
    if len(sys.argv) > 1:
        try:
            target_rate = int(sys.argv[1])
        except ValueError:
            print("Invalid sampling rate. Using default 800 Hz.")
    
    reader = HighSpeedSensorReader(target_rate=target_rate)
    reader.run()