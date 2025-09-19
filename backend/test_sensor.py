#!/usr/bin/env python3
"""
Test script to verify sensor connectivity and real data reading.
"""

import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.append(str(Path(__file__).parent))

from sensor_service import SensorService

def test_sensor_connection():
    """Test the sensor connection and data reading."""
    print("Testing sensor connection...")
    
    try:
        # Create a sensor service instance (this will attempt to connect to the sensor)
        service = SensorService()
        print("Sensor connected successfully!")
        
        # Try to read data
        data = service._get_sensor_data()
        print(f"Sensor data: X={data['x']:.3f}, Y={data['y']:.3f}, Z={data['z']:.3f}, Total={data['total']:.3f}")
        print("Sensor is working correctly!")
        
    except Exception as e:
        print(f"Error testing sensor: {e}")
        print("Please check sensor connection and I2C configuration.")
        return False
    
    return True

if __name__ == "__main__":
    test_sensor_connection()