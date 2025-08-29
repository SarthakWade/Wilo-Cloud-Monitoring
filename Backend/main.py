#!/usr/bin/env python3
"""
Main orchestration script for the File-Generation-RPI system.
High-frequency sensor data collection at 800 Hz.
"""

import argparse
import sys
import os
import time
import signal
import threading
from files import HighFrequencyDataCollector, load_and_analyze_data
from api import run_api_server

# Global flags for graceful shutdown
running = True
api_thread = None

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    global running
    print("\nReceived interrupt signal. Shutting down gracefully...")
    running = False

def continuous_collection(collector, file_duration=1):
    """
    Run continuous data collection, creating new files at regular intervals.
    
    Args:
        collector: HighFrequencyDataCollector instance
        file_duration: Duration for each data file in seconds (default: 1)
    """
    global running
    
    print(f"Starting continuous data collection at {collector.target_hz} Hz...")
    print(f"New files will be created every {file_duration} second(s)")
    print("Press Ctrl+C to stop")
    
    file_counter = 0
    
    while running:
        try:
            # Collect data for the specified duration
            collector.collect_continuous(duration_seconds=file_duration)
            
            file_counter += 1
            print(f"Completed file #{file_counter}")
            
            # Brief pause between files
            if running:
                time.sleep(0.01)  # Short pause to prevent excessive CPU usage
                
        except Exception as e:
            print(f"Error during continuous collection: {e}")
            if running:
                print("Attempting to continue...")
                time.sleep(1)
    
    print("Continuous collection stopped.")

def start_api_server(port=8000):
    """Start the API server in a separate thread"""
    global api_thread
    
    def api_worker():
        run_api_server(port)
    
    api_thread = threading.Thread(target=api_worker, daemon=True)
    api_thread.start()
    print(f"API server started on port {port}")

def main():
    parser = argparse.ArgumentParser(description="High-Frequency Sensor Data Collection System")
    parser.add_argument("--duration", type=int, default=1, help="Collection duration per file in seconds (default: 1)")
    parser.add_argument("--rate", type=int, default=800, help="Sampling rate in Hz (default: 800)")
    parser.add_argument("--batch", type=int, default=100, help="Batch size (default: 100)")
    parser.add_argument("--analyze", type=str, help="Analyze a specific CSV file")
    parser.add_argument("--continuous", action="store_true", help="Run in continuous mode")
    parser.add_argument("--api", action="store_true", help="Start API server")
    parser.add_argument("--api-port", type=int, default=8000, help="API server port (default: 8000)")
    
    args = parser.parse_args()
    
    # If analyze mode is specified
    if args.analyze:
        load_and_analyze_data(args.analyze)
        return
    
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start API server if requested
    if args.api:
        start_api_server(args.api_port)
    
    # Create data collector
    collector = HighFrequencyDataCollector(
        target_hz=args.rate,
        batch_size=args.batch
    )
    
    try:
        # Initialize sensor
        collector.initialize_sensor()
        
        if args.continuous:
            # Run continuous collection
            continuous_collection(collector, file_duration=args.duration)
        else:
            # Collect data once
            collector.collect_continuous(duration_seconds=args.duration)
        
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up
        collector.close()
        print("System shutdown complete.")

if __name__ == "__main__":
    main()