#!/usr/bin/env python3
"""
Test script to demonstrate the aggregation functionality.
"""

import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.append(str(Path(__file__).parent))

from sensor_service import SensorService

def test_aggregation():
    """Test the aggregation functionality."""
    print("Testing data aggregation...")
    
    # Create a sensor service instance
    service = SensorService()
    
    # Run aggregation
    service._aggregate_data()
    
    print("Aggregation test completed.")

if __name__ == "__main__":
    test_aggregation()