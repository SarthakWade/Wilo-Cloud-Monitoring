#!/usr/bin/env python3
"""
Simple script to test I2C communication directly.
"""

import smbus2
import time

def test_i2c_communication():
    """Test direct I2C communication with MPU6050."""
    print("Testing direct I2C communication with MPU6050...")
    
    try:
        # Create I2C bus object
        bus = smbus2.SMBus(1)
        print("I2C bus 1 opened successfully")
        
        # MPU6050 address
        address = 0x68
        
        # Try to read the WHO_AM_I register (should return 0x68)
        who_am_i = bus.read_byte_data(address, 0x75)
        print(f"WHO_AM_I register value: 0x{who_am_i:02X}")
        
        if who_am_i == 0x68:
            print("SUCCESS: MPU6050 responded correctly!")
            print("Sensor is connected and responding.")
        else:
            print(f"WARNING: Expected 0x68, got 0x{who_am_i:02X}")
            print("Sensor may be connected but not responding correctly.")
            
        bus.close()
        return True
        
    except OSError as e:
        print(f"ERROR: I2C communication failed: {e}")
        print("Possible causes:")
        print("1. Sensor not connected properly")
        print("2. Incorrect wiring")
        print("3. Sensor damaged")
        print("4. I2C bus not available")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

if __name__ == "__main__":
    test_i2c_communication()#!/usr/bin/env python3
"""
Simple script to test I2C communication directly.
"""

import smbus2
import time

def test_i2c_communication():
    """Test direct I2C communication with MPU6050."""
    print("Testing direct I2C communication with MPU6050...")
    
    try:
        # Create I2C bus object
        bus = smbus2.SMBus(1)
        print("I2C bus 1 opened successfully")
        
        # MPU6050 address
        address = 0x68
        
        # Try to read the WHO_AM_I register (should return 0x68)
        who_am_i = bus.read_byte_data(address, 0x75)
        print(f"WHO_AM_I register value: 0x{who_am_i:02X}")
        
        if who_am_i == 0x68:
            print("SUCCESS: MPU6050 responded correctly!")
            print("Sensor is connected and responding.")
        else:
            print(f"WARNING: Expected 0x68, got 0x{who_am_i:02X}")
            print("Sensor may be connected but not responding correctly.")
            
        bus.close()
        return True
        
    except OSError as e:
        print(f"ERROR: I2C communication failed: {e}")
        print("Possible causes:")
        print("1. Sensor not connected properly")
        print("2. Incorrect wiring")
        print("3. Sensor damaged")
        print("4. I2C bus not available")
        return False
    except Exception as e:
        print(f"ERROR: Unexpected error: {e}")
        return False

if __name__ == "__main__":
    test_i2c_communication()