#!/usr/bin/env python3
"""
Real-time sensor service with CSV generation
"""

import time
import asyncio
import threading
from datetime import datetime
from mpu6050 import mpu6050
from csv_generator import CSVGenerator
import json

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
        """Connect to MPU6050 sensor"""
        try:
            self.mpu = mpu6050(0x68)  # Default I2C address
            self.connected = True
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor connected successfully")
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
    
    def update_sampling_rate(self, new_rate: int):
        """Update sampling rate dynamically"""
        with self.lock:
            if new_rate < 100 or new_rate > 1000:
                print(f"Invalid sampling rate: {new_rate}. Must be between 100-1000 Hz")
                return False
            
            old_rate = self.sampling_rate
            self.sampling_rate = new_rate
            self.sample_interval = 1.0 / new_rate
            
            # Update CSV generator
            self.csv_generator.update_sampling_rate(new_rate)
            
            print(f"Sampling rate changed: {old_rate} Hz → {new_rate} Hz")
            return True
    
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
        """Start the sensor service"""
        if self.running:
            print("Service is already running")
            return
        
        self.running = True
        self.paused = False
        
        print("Starting sensor service...")
        
        # Start the main sensor loop in a separate thread
        self.sensor_thread = threading.Thread(target=self._sensor_loop, daemon=True)
        self.sensor_thread.start()
        
        print("Sensor service started")
    
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
        
        # Save any remaining data
        self.csv_generator.force_save()
        
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
        """Main sensor reading loop"""
        print("Sensor loop started")
        
        while self.running:
            if self.paused:
                time.sleep(0.1)
                continue
            
            # Try to connect if not connected
            if not self.connected:
                if not self.connect_sensor():
                    time.sleep(2)  # Wait before retry
                    continue
            
            try:
                loop_start = time.time()
                current_time = datetime.now()
                current_second = current_time.replace(microsecond=0)
                
                # Reset counter for new second
                if self.last_second != current_second:
                    if self.samples_this_second > 0:
                        print(f"[{current_second.strftime('%H:%M:%S')}] Completed second with {self.samples_this_second} samples")
                    self.samples_this_second = 0
                    self.last_second = current_second
                
                # Read sensor data
                accel_data = self.mpu.get_accel_data()
                x, y, z = accel_data['x'], accel_data['y'], accel_data['z']
                
                # Calculate total acceleration magnitude
                acceleration = (x**2 + y**2 + z**2)**0.5
                
                # Add to CSV generator
                self.csv_generator.add_sample(current_time, acceleration)
                
                # Update counters
                with self.lock:
                    self.total_samples += 1
                    self.samples_this_second += 1
                
                # Calculate sleep time to maintain target sampling rate
                elapsed = time.time() - loop_start
                sleep_time = max(0, self.sample_interval - elapsed)
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
                else:
                    # If we're running behind, log it occasionally
                    if self.total_samples % 1000 == 0:
                        print(f"Warning: Running {elapsed - self.sample_interval:.4f}s behind target")
                
            except Exception as e:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sensor read error: {e}")
                self.connected = False
                self.mpu = None
                time.sleep(1)  # Brief pause before reconnection attempt
        
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
        time.sleep(5)
        
        # Test sampling rate change
        print("\nChanging sampling rate to 400 Hz...")
        service.update_sampling_rate(400)
        
        time.sleep(3)
        
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