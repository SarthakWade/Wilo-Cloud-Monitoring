#!/usr/bin/env python3
"""
Simple sensor data printer - works directly in Backend directory.
"""

import time
import signal
import sys
from datetime import datetime
from mpu6050 import mpu6050

def print_sensor_data():
    """Simple function to print sensor data continuously"""
    
    mpu = None
    sample_count = 0
    
    print("Real-time Sensor Data:")
    print("-" * 60)
    print(f"{'Time':<12} {'X-Axis':<10} {'Y-Axis':<10} {'Z-Axis':<10} {'Total':<10}")
    print("-" * 60)
    
    try:
        while True:
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            # Try to connect if not connected
            if mpu is None:
                try:
                    print(f"{timestamp:<12} Connecting to MPU6050...")
                    mpu = mpu6050(0x68)  # Default I2C address
                    print(f"{timestamp:<12} Sensor connected!")
                except Exception as e:
                    print(f"{timestamp:<12} Connection failed: {e}")
                    mpu = None
                    time.sleep(2)  # Wait before retry
                    continue
            
            # Try to read sensor data
            try:
                accel_data = mpu.get_accel_data()
                x, y, z = accel_data['x'], accel_data['y'], accel_data['z']
                total = (x**2 + y**2 + z**2)**0.5
                
                print(f"{timestamp:<12} {x:<10.3f} {y:<10.3f} {z:<10.3f} {total:<10.3f}")
                sample_count += 1
                
            except Exception as e:
                print(f"{timestamp:<12} Read error: {e}")
                print(f"{timestamp:<12} Attempting reconnection...")
                mpu = None  # Force reconnection on next loop
                time.sleep(1)  # Brief pause before reconnection
                continue
            
            time.sleep(0.5)  # 2 Hz sampling for readability
            
    except KeyboardInterrupt:
        print(f"\nStopped after {sample_count} samples")
    finally:
        print("Goodbye!")

if __name__ == "__main__":
    print("MPU6050 Sensor Data Printer")
    print("Press Ctrl+C to stop")
    print_sensor_data()