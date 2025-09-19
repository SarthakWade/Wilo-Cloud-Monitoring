#!/usr/bin/env python3
"""
Simple script to test hardware connection to MPU6050 sensor.
"""

def test_sensor_connection():
    """Test if we can connect to the MPU6050 sensor."""
    print("Testing MPU6050 sensor connection...")
    
    try:
        from mpu6050 import mpu6050
        sensor = mpu6050(0x68)
        print("SUCCESS: Connected to MPU6050 sensor at address 0x68")
        
        # Try to read some data
        accel_data = sensor.get_accel_data()
        print(f"Acceleration data: {accel_data}")
        
        gyro_data = sensor.get_gyro_data()
        print(f"Gyroscope data: {gyro_data}")
        
        temp = sensor.get_temp()
        print(f"Temperature: {temp}°C")
        
        print("Hardware connection test PASSED")
        return True
        
    except ImportError:
        print("ERROR: mpu6050 module not installed")
        print("Please install it with: pip install mpu6050-raspberrypi")
        return False
    except Exception as e:
        print(f"ERROR: Failed to connect to sensor: {e}")
        print("Possible causes:")
        print("1. Sensor not connected properly")
        print("2. Incorrect wiring")
        print("3. Sensor damaged")
        print("4. I2C not enabled")
        print("5. Wrong I2C address (should be 0x68)")
        return False

if __name__ == "__main__":
    test_sensor_connection()