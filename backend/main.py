#!/usr/bin/env python3
"""
Main entry point for the Wilo Cloud Monitoring backend.
"""

import argparse
import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.append(str(Path(__file__).parent))

from sensor_service import SensorService

def main():
    parser = argparse.ArgumentParser(description="Wilo Cloud Monitoring Backend")
    parser.add_argument(
        "--config", 
        default="config.json",
        help="Path to configuration file (default: config.json)"
    )
    
    args = parser.parse_args()
    
    try:
        # Initialize and start the sensor service
        service = SensorService(args.config)
        service.collect_data()
    except Exception as e:
        print(f"Error running sensor service: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())