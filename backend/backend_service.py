#!/usr/bin/env python3
"""
Main backend service - unified entry point
"""

import asyncio
import signal
import sys
import json
from pathlib import Path
from websocket_server import EnhancedWebSocketServer
from sensor_service import SensorService

class BackendService:
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
                "default_sampling_rate": 800,
                "min_sampling_rate": 100,
                "max_sampling_rate": 1000
            },
            "csv": {
                "readings_directory": "readings",
                "retention_days": 365
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
        
        if self.websocket_server:
            self.websocket_server.running = False
            if self.websocket_server.sensor_service:
                self.websocket_server.sensor_service.stop()
        
        print("Backend service stopped")
        sys.exit(0)
    
    async def start(self):
        """Start the backend service"""
        print("=" * 60)
        print("WILO SENSOR BACKEND SERVICE")
        print("=" * 60)
        print(f"Default sampling rate: {self.config['sensor']['default_sampling_rate']} Hz")
        print(f"CSV directory: {self.config['csv']['readings_directory']}")
        print(f"WebSocket: {self.config['websocket']['host']}:{self.config['websocket']['port']}")
        print(f"Data retention: {self.config['csv']['retention_days']} days")
        print("=" * 60)
        
        # Setup signal handlers
        self.setup_signal_handlers()
        
        # Create readings directory
        readings_dir = Path(self.config['csv']['readings_directory'])
        readings_dir.mkdir(exist_ok=True)
        
        # Start WebSocket server (which includes sensor service)
        self.websocket_server = EnhancedWebSocketServer()
        self.running = True
        
        try:
            await self.websocket_server.start_server()
        except Exception as e:
            print(f"Error starting server: {e}")
            self.shutdown()

def main():
    """Main entry point"""
    service = BackendService()
    
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