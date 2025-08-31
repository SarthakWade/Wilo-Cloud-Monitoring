#!/usr/bin/env python3
"""
Enhanced WebSocket server with CSV file monitoring and command handling
"""

import asyncio
import websockets
import json
import os
from datetime import datetime
from pathlib import Path
from sensor_service import SensorService
import threading

class EnhancedWebSocketServer:
    def __init__(self):
        self.clients = set()
        self.sensor_service = SensorService()
        self.running = False
        self.readings_dir = Path("readings")
        self.last_file_count = 0
        
    async def register_client(self, websocket):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")
        
        # Send initial status
        await self.send_status_update(websocket)
        
    async def unregister_client(self, websocket):
        """Unregister a WebSocket client"""
        if websocket in self.clients:
            self.clients.remove(websocket)
        print(f"Client disconnected. Total clients: {len(self.clients)}")
        
    async def send_to_all_clients(self, message):
        """Send message to all connected clients"""
        if self.clients:
            disconnected = []
            for client in self.clients:
                try:
                    await client.send(message)
                except websockets.exceptions.ConnectionClosed:
                    disconnected.append(client)
                except Exception as e:
                    print(f"Error sending to client: {e}")
                    disconnected.append(client)
            
            # Remove disconnected clients
            for client in disconnected:
                self.clients.discard(client)
    
    async def send_status_update(self, websocket=None):
        """Send status update to client(s)"""
        status = self.sensor_service.get_status()
        
        status_message = {
            "type": "status",
            "data": {
                "connected": status['connected'],
                "sampling_rate": status['sampling_rate'],
                "total_samples": status['total_samples'],
                "csv_files": status['csv_stats']['total_files'],
                "latest_file": self.sensor_service.csv_generator.get_latest_file()
            }
        }
        
        message = json.dumps(status_message)
        
        if websocket:
            try:
                await websocket.send(message)
            except:
                pass
        else:
            await self.send_to_all_clients(message)
    
    async def handle_command(self, websocket, command_data):
        """Handle commands from frontend"""
        command = command_data.get('command')
        
        if command == 'set_sampling_rate':
            new_rate = command_data.get('rate', 800)
            success = self.sensor_service.update_sampling_rate(new_rate)
            
            response = {
                "type": "command_response",
                "command": "set_sampling_rate",
                "success": success,
                "new_rate": new_rate if success else self.sensor_service.sampling_rate
            }
            
            await websocket.send(json.dumps(response))
            
            # Send status update to all clients
            await self.send_status_update()
            
        elif command == 'get_status':
            await self.send_status_update(websocket)
            
        elif command == 'start_collection':
            self.sensor_service.start()
            await self.send_status_update()
            
        elif command == 'stop_collection':
            self.sensor_service.stop()
            await self.send_status_update()
            
        elif command == 'pause_collection':
            self.sensor_service.pause()
            await self.send_status_update()
            
        elif command == 'resume_collection':
            self.sensor_service.resume()
            await self.send_status_update()
            
        elif command == 'get_file_list':
            files = self.sensor_service.csv_generator.get_file_list()
            response = {
                "type": "file_list",
                "files": files[:100]  # Limit to last 100 files
            }
            await websocket.send(json.dumps(response))
            
        elif command == 'get_folder_structure':
            structure = self.sensor_service.csv_generator.get_folder_structure()
            response = {
                "type": "folder_structure",
                "structure": structure
            }
            await websocket.send(json.dumps(response))
            
        else:
            error_response = {
                "type": "error",
                "message": f"Unknown command: {command}"
            }
            await websocket.send(json.dumps(error_response))
    
    async def monitor_csv_files(self):
        """Monitor CSV files and notify clients of new files"""
        while self.running:
            try:
                current_file_count = len(list(self.readings_dir.glob("*.csv")))
                
                if current_file_count != self.last_file_count:
                    self.last_file_count = current_file_count
                    
                    # Notify clients of new file
                    latest_file = self.sensor_service.csv_generator.get_latest_file()
                    if latest_file:
                        notification = {
                            "type": "new_file",
                            "filename": latest_file,
                            "total_files": current_file_count
                        }
                        await self.send_to_all_clients(json.dumps(notification))
                
                await asyncio.sleep(1)  # Check every second
                
            except Exception as e:
                print(f"Error monitoring CSV files: {e}")
                await asyncio.sleep(5)
    
    async def handle_client(self, websocket, path):
        """Handle individual WebSocket client"""
        await self.register_client(websocket)
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.handle_command(websocket, data)
                except json.JSONDecodeError:
                    error_response = {
                        "type": "error",
                        "message": "Invalid JSON format"
                    }
                    await websocket.send(json.dumps(error_response))
                except Exception as e:
                    error_response = {
                        "type": "error",
                        "message": f"Command error: {str(e)}"
                    }
                    await websocket.send(json.dumps(error_response))
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            print(f"Client handler error: {e}")
        finally:
            await self.unregister_client(websocket)
    
    async def periodic_status_update(self):
        """Send periodic status updates to all clients"""
        while self.running:
            await asyncio.sleep(5)  # Every 5 seconds
            if self.clients:
                await self.send_status_update()
    
    async def start_server(self):
        """Start the WebSocket server and all background tasks"""
        self.running = True
        
        # Ensure readings directory exists
        self.readings_dir.mkdir(exist_ok=True)
        
        # Start sensor service
        self.sensor_service.start()
        
        # Start background tasks
        file_monitor_task = asyncio.create_task(self.monitor_csv_files())
        status_update_task = asyncio.create_task(self.periodic_status_update())
        
        # Start WebSocket server
        server = await websockets.serve(self.handle_client, "localhost", 8765)
        print("Enhanced WebSocket server started on ws://localhost:8765")
        print("Commands supported:")
        print("  - set_sampling_rate: Change sampling rate")
        print("  - get_status: Get current status")
        print("  - start_collection/stop_collection: Control data collection")
        print("  - get_file_list: Get list of CSV files")
        
        try:
            await server.wait_closed()
        finally:
            self.running = False
            self.sensor_service.stop()

if __name__ == "__main__":
    server = EnhancedWebSocketServer()
    try:
        asyncio.run(server.start_server())
    except KeyboardInterrupt:
        print("\nServer stopped")
    except Exception as e:
        print(f"Server error: {e}")