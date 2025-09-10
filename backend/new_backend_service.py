#!/usr/bin/env python3
"""
New Backend Service - redesigned architecture for high-speed sensor data collection
"""

import asyncio
import signal
import sys
import json
from pathlib import Path
from high_speed_websocket_server import HighSpeedWebSocketServer

class NewBackendService:
    def __init__(self, config_file="config.json"):
        self.config = self.load_config(config_file)
        self.websocket_server = None
        self.running = False
        
    def load_config(self, config_file):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            print(f"Configuration loaded from {config_file}")
            return config
        except FileNotFoundError:
            print(f"Config file {config_file} not found, using defaults")
            return self.get_default_config()
        except json.JSONDecodeError as e:
            print(f"Error parsing config file: {e}")
            return self.get_default_config()
    
    def get_default_config(self):
        """Get default configuration"""
        return {
            "sensor": {
                "sampling_rate": 800
            },
            "csv": {
                "readings_directory": "readings",
                "max_files": 120
            },
            "websocket": {
                "host": "localhost",
                "port": 8765
            }
        }
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            print(f"\nReceived signal {signum}, shutting down gracefully...")
            self.shutdown()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def shutdown(self):
        """Graceful shutdown"""
        print("Shutting down backend service...")
        self.running = False
        
        print("Backend service stopped")
        sys.exit(0)
    
    async def start(self):
        """Start the backend service"""
        print("=" * 60)
        print("WILO HIGH-SPEED SENSOR BACKEND SERVICE")
        print("=" * 60)
        print(f"Sampling rate: {self.config['sensor']['sampling_rate']} Hz (every 1.25ms)")
        print(f"Maximum files: {self.config['csv']['max_files']} (2 hours of data)")
        print(f"CSV directory: {self.config['csv']['readings_directory']}")
        print(f"WebSocket: {self.config['websocket']['host']}:{self.config['websocket']['port']}")
        print("=" * 60)
        
        # Setup signal handlers
        self.setup_signal_handlers()
        
        # Start WebSocket server (which includes high-speed sensor service)
        self.websocket_server = HighSpeedWebSocketServer()
        self.running = True
        
        try:
            await self.websocket_server.start_server()
        except Exception as e:
            print(f"Error starting server: {e}")
            self.shutdown()

def main():
    """Main entry point"""
    service = NewBackendService()
    
    try:
        asyncio.run(service.start())
    except KeyboardInterrupt:
        print("\nShutdown requested")
    except Exception as e:
        print(f"Service error: {e}")
    finally:
        print("Goodbye!")

if __name__ == "__main__":
    main()#!/usr/bin/env python3
"""
New Backend Service - redesigned architecture for high-speed sensor data collection
"""

import asyncio
import signal
import sys
import json
from pathlib import Path
from high_speed_websocket_server import HighSpeedWebSocketServer

class NewBackendService:
    def __init__(self, config_file="config.json"):
        self.config = self.load_config(config_file)
        self.websocket_server = None
        self.running = False
        
    def load_config(self, config_file):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
            print(f"Configuration loaded from {config_file}")
            return config
        except FileNotFoundError:
            print(f"Config file {config_file} not found, using defaults")
            return self.get_default_config()
        except json.JSONDecodeError as e:
            print(f"Error parsing config file: {e}")
            return self.get_default_config()
    
    def get_default_config(self):
        """Get default configuration"""
        return {
            "sensor": {
                "sampling_rate": 800
            },
            "csv": {
                "readings_directory": "readings",
                "max_files": 120
            },
            "websocket": {
                "host": "localhost",
                "port": 8765
            }
        }
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            print(f"\nReceived signal {signum}, shutting down gracefully...")
            self.shutdown()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def shutdown(self):
        """Graceful shutdown"""
        print("Shutting down backend service...")
        self.running = False
        
        print("Backend service stopped")
        sys.exit(0)
    
    async def start(self):
        """Start the backend service"""
        print("=" * 60)
        print("WILO HIGH-SPEED SENSOR BACKEND SERVICE")
        print("=" * 60)
        print(f"Sampling rate: {self.config['sensor']['sampling_rate']} Hz (every 1.25ms)")
        print(f"Maximum files: {self.config['csv']['max_files']} (2 hours of data)")
        print(f"CSV directory: {self.config['csv']['readings_directory']}")
        print(f"WebSocket: {self.config['websocket']['host']}:{self.config['websocket']['port']}")
        print("=" * 60)
        
        # Setup signal handlers
        self.setup_signal_handlers()
        
        # Start WebSocket server (which includes high-speed sensor service)
        self.websocket_server = HighSpeedWebSocketServer()
        self.running = True
        
        try:
            await self.websocket_server.start_server()
        except Exception as e:
            print(f"Error starting server: {e}")
            self.shutdown()

def main():
    """Main entry point"""
    service = NewBackendService()
    
    try:
        asyncio.run(service.start())
    except KeyboardInterrupt:
        print("\nShutdown requested")
    except Exception as e:
        print(f"Service error: {e}")
    finally:
        print("Goodbye!")

if __name__ == "__main__":
    main()