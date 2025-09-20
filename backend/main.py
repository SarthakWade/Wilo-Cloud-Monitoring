#!/usr/bin/env python3
"""
Main entry point for the Wilo Cloud Monitoring backend.
"""

import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.append(str(Path(__file__).parent))

from sensor import SensorReader

def main():
    try:
        # Initialize and start the sensor reader
        reader = SensorReader()
        reader.run()
    except Exception as e:
        print(f"Error running sensor service: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())