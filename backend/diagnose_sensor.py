#!/usr/bin/env python3
"""
Diagnostic script to check sensor connectivity.
"""

import smbus2
import time

def scan_i2c_bus(bus_number=1):
    """Scan I2C bus for devices."""
    print(f"Scanning I2C bus {bus_number}...")
    bus = smbus2.SMBus(bus_number)
    
    devices = []
    for addr in range(0x03, 0x78):
        try:
            bus.read_byte(addr)
            devices.append(addr)
            print(f"Found device at address: 0x{addr:02X}")
        except:
            pass
    
    bus.close()
    
    if not devices:
        print("No devices found on I2C bus.")
    
    return devices

def test_mpu6050():
    """Test MPU6050 sensor specifically."""
    try:
        from mpu6050 import mpu6050
        sensor = mpu6050(0x68)
        print("MPU6050 sensor connected successfully!")
        
        # Try to read data
        accel = sensor.get_accel_data()
        gyro = sensor.get_gyro_data()
        temp = sensor.get_temp()
        
        print(f"Acceleration: X={accel['x']:.3f}, Y={accel['y']:.3f}, Z={accel['z']:.3f}")
        print(f"Gyroscope: X={gyro['x']:.3f}, Y={gyro['y']:.3f}, Z={gyro['z']:.3f}")
        print(f"Temperature: {temp:.2f}°C")
        
        return True
    except Exception as e:
        print(f"Error connecting to MPU6050: {e}")
        return False

if __name__ == "__main__":
    print("=== Sensor Diagnostic Tool ===")
    
    # Scan I2C bus
    devices = scan_i2c_bus(1)
    
    # Check for common sensor addresses
    common_addresses = {
        0x68: "MPU6050 (Accelerometer/Gyroscope)",
        0x76: "BME280 (Environmental Sensor)",
        0x77: "BMP280 (Pressure Sensor)",
        0x48: "ADS1115 (ADC)"
    }
    
    print("\nDetected devices:")
    for addr in devices:
        if addr in common_addresses:
            print(f"  0x{addr:02X}: {common_addresses[addr]}")
        else:
            print(f"  0x{addr:02X}: Unknown device")
    
    print("\n=== Testing MPU6050 ===")
    test_mpu6050()