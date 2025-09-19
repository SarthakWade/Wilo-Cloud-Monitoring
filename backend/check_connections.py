#!/usr/bin/env python3
"""
Script to check hardware connections for MPU6050 sensor.
"""

import RPi.GPIO as GPIO
import time

def check_power_pins():
    """Check if power pins are properly connected."""
    print("Checking power connections...")
    print("Please verify the following connections:")
    print("1. MPU6050 VCC (VDD) pin connected to Raspberry Pi 3.3V (Pin 1)")
    print("2. MPU6050 GND pin connected to Raspberry Pi Ground (Pin 6)")
    print("3. MPU6050 SCL pin connected to Raspberry Pi GPIO 3 (Pin 5)")
    print("4. MPU6050 SDA pin connected to Raspberry Pi GPIO 2 (Pin 3)")
    print("")
    print("Common issues:")
    print("- Loose connections")
    print("- Incorrect wiring")
    print("- Damaged sensor")
    print("- Wrong voltage (MPU6050 requires 3.3V, not 5V)")
    print("")

def check_i2c_pins():
    """Check I2C pin states."""
    print("Checking I2C pin states...")
    
    # Set up GPIO
    GPIO.setmode(GPIO.BCM)
    
    try:
        # Check SDA (GPIO 2) and SCL (GPIO 3) pins
        sda_pin = 2
        scl_pin = 3
        
        # Set as input with pull-up
        GPIO.setup(sda_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(scl_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        sda_state = GPIO.input(sda_pin)
        scl_state = GPIO.input(scl_pin)
        
        print(f"SDA (GPIO 2) state: {sda_state} (should be 1/high when not connected to sensor)")
        print(f"SCL (GPIO 3) state: {scl_state} (should be 1/high when not connected to sensor)")
        
        if sda_state == 0 or scl_state == 0:
            print("WARNING: One or both I2C lines are pulled low!")
            print("This could indicate:")
            print("- Sensor is connected but not powered")
            print("- Short circuit on I2C lines")
            print("- Damaged sensor pulling lines low")
        
    except Exception as e:
        print(f"Error checking I2C pins: {e}")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    print("=== MPU6050 Connection Diagnostic ===")
    print("")
    check_power_pins()
    check_i2c_pins()
    print("If all connections are correct and the sensor is still not detected,")
    print("try the following:")
    print("1. Power cycle the Raspberry Pi")
    print("2. Check for damaged wires or connectors")
    print("3. Try a different MPU6050 sensor")
    print("4. Verify the sensor is a genuine MPU6050 (some clones have different addresses)")#!/usr/bin/env python3
"""
Script to check hardware connections for MPU6050 sensor.
"""

import RPi.GPIO as GPIO
import time

def check_power_pins():
    """Check if power pins are properly connected."""
    print("Checking power connections...")
    print("Please verify the following connections:")
    print("1. MPU6050 VCC (VDD) pin connected to Raspberry Pi 3.3V (Pin 1)")
    print("2. MPU6050 GND pin connected to Raspberry Pi Ground (Pin 6)")
    print("3. MPU6050 SCL pin connected to Raspberry Pi GPIO 3 (Pin 5)")
    print("4. MPU6050 SDA pin connected to Raspberry Pi GPIO 2 (Pin 3)")
    print("")
    print("Common issues:")
    print("- Loose connections")
    print("- Incorrect wiring")
    print("- Damaged sensor")
    print("- Wrong voltage (MPU6050 requires 3.3V, not 5V)")
    print("")

def check_i2c_pins():
    """Check I2C pin states."""
    print("Checking I2C pin states...")
    
    # Set up GPIO
    GPIO.setmode(GPIO.BCM)
    
    try:
        # Check SDA (GPIO 2) and SCL (GPIO 3) pins
        sda_pin = 2
        scl_pin = 3
        
        # Set as input with pull-up
        GPIO.setup(sda_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(scl_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        sda_state = GPIO.input(sda_pin)
        scl_state = GPIO.input(scl_pin)
        
        print(f"SDA (GPIO 2) state: {sda_state} (should be 1/high when not connected to sensor)")
        print(f"SCL (GPIO 3) state: {scl_state} (should be 1/high when not connected to sensor)")
        
        if sda_state == 0 or scl_state == 0:
            print("WARNING: One or both I2C lines are pulled low!")
            print("This could indicate:")
            print("- Sensor is connected but not powered")
            print("- Short circuit on I2C lines")
            print("- Damaged sensor pulling lines low")
        
    except Exception as e:
        print(f"Error checking I2C pins: {e}")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    print("=== MPU6050 Connection Diagnostic ===")
    print("")
    check_power_pins()
    check_i2c_pins()
    print("If all connections are correct and the sensor is still not detected,")
    print("try the following:")
    print("1. Power cycle the Raspberry Pi")
    print("2. Check for damaged wires or connectors")
    print("3. Try a different MPU6050 sensor")
    print("4. Verify the sensor is a genuine MPU6050 (some clones have different addresses)")