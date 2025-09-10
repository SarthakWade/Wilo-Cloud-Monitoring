#!/usr/bin/env python3
"""
Main entry point for the Wilo Cloud Monitoring Backend
"""

import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def main():
    """Main function - run the new high-speed backend service"""
    print("Wilo Cloud Monitoring Backend")
    print("Starting high-speed sensor data collection service...")
    
    # Import and run the new backend service
    try:
        from new_backend_service import main as new_backend_main
        new_backend_main()
    except ImportError as e:
        print(f"Error importing new backend service: {e}")
        print("Please ensure all required files are in place.")
        sys.exit(1)
    except Exception as e:
        print(f"Error running backend service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
