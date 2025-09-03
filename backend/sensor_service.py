#!/usr/bin/env python3
"""
Real-time sensor service with optimized CSV generation
"""

import time
import asyncio
import threading
from datetime import datetime
from mpu6050 import mpu6050
from csv_generator import CSVGenerator
import json
import os
import psutil

class SensorService:
    def __init__(self, initial_sampling_rate: int = 800):
        self.sampling_rate = initial_sampling_rate
        self.sample_interval = 1.0 / initial_sampling_rate
        
        # Sensor connection
        self.mpu = None
        self.connected = False
        
        # CSV generator
        self.csv_generator = CSVGenerator(initial_sampling_rate)
        
        # Control flags
        self.running = False
        self.paused = False
        
        # Statistics
        self.total_samples = 0
        self.samples_this_second = 0
        self.last_second = None
        
        # Thread safety
        self.lock = threading.Lock()
        
        print(f"Sensor Service initialized")
        print(f"Initial sampling rate: {initial_sampling_rate} Hz")
    
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
    
    # Sampling rate is now fixed at initialization - no dynamic updates
    
    def get_status(self) -> dict:
        """Get current service status"""
        return {
            'connected': self.connected,
            'running': self.running,
            'paused': self.paused,
            'sampling_rate': self.sampling_rate,
            'total_samples': self.total_samples,
            'samples_this_second': self.samples_this_second,
            'csv_stats': self.csv_generator.get_file_stats()
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
        self.csv_generator.force_save()
        self.csv_generator.cleanup()
        
        print("Sensor service stopped")
    
    def pause(self):
        """Pause data collection"""
        self.paused = True
        print("Data collection paused")
    
    def resume(self):
        """Resume data collection"""
        self.paused = False
        print("Data collection resumed")
    
    def _sensor_loop(self):
        """Optimized sensor loop for high-frequency sampling"""
        print(f"Sensor loop started - Target: {self.sampling_rate} Hz")
        
        # Pre-calculate timing constants for maximum performance
        target_interval = 1.0 / self.sampling_rate
        samples_per_status = self.sampling_rate
        
        # Pre-allocate variables to avoid repeated allocation
        sample_count = 0
        last_status_time = time.perf_counter()
        last_second_boundary = None
        samples_this_second = 0
        
        # Optimization: pre-import needed functions
        perf_counter = time.perf_counter
        datetime_now = datetime.now
        
        print(f"Target interval: {target_interval*1000:.3f}ms per sample")
        
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
                
                # Optimized CSV generation
                self.csv_generator.add_sample_ultra_fast(current_time, acceleration)
                
                # Minimal counter updates
                sample_count += 1
                samples_this_second += 1
                
                # Update status infrequently to minimize overhead
                current_perf_time = perf_counter()
                if current_perf_time - last_status_time >= 1.0:
                    current_second = current_time.replace(microsecond=0)
                    if last_second_boundary != current_second:
                        if samples_this_second > 0:
                            print(f"[{current_second.strftime('%H:%M:%S')}] Achieved {samples_this_second} samples/sec (Target: {self.sampling_rate})")
                        samples_this_second = 0
                        last_second_boundary = current_second
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
        
        print("Sensor loop ended")
    
    def cleanup_old_files(self):
        """Clean up old CSV files (keep 1 year)"""
        self.csv_generator.cleanup_old_files(days_to_keep=365)

def main():
    """Main function for testing"""
    service = SensorService()
    
    try:
        service.start()
        
        # Let it run for a few seconds
        time.sleep(8)
        
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