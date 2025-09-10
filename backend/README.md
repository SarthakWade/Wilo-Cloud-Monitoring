# Wilo Cloud Monitoring Backend - High-Speed Architecture

## Overview

This is the redesigned backend architecture for the Wilo Cloud Monitoring system. The new architecture is optimized for high-speed sensor data collection at 800 readings per second (every 1.25ms) with efficient file management.

## Key Features

1. **High-Speed Data Collection**: Collects sensor readings at 800 Hz (every 1.25ms)
2. **Efficient File Management**: Maintains a maximum of 120 CSV files (2 hours of data)
3. **Real-time Aggregation**: Creates an aggregate CSV file combining all individual files
4. **WebSocket Communication**: Real-time data streaming to frontend
5. **Hierarchical Storage**: Organizes data in a structured folder hierarchy

## Architecture Components

### 1. HighSpeedSensorService
- Collects sensor data at 800 Hz
- Manages CSV file generation with a maximum of 120 files
- Maintains an aggregate CSV file with all data
- Implements efficient timing control for precise sampling

### 2. HighSpeedWebSocketServer
- Handles real-time communication with frontend
- Manages client connections and data streaming
- Provides file listing and data retrieval capabilities
- Supports data export functionality

### 3. File Management
- Stores data in hierarchical structure: `readings/YYYY/MM/Week_N/DD/HHMMSS.csv`
- Automatically removes oldest files when limit is reached
- Maintains aggregate data file for easy access to all collected data

## Data Flow

1. Sensor data is collected at 800 Hz (every 1.25ms)
2. Data is buffered for 1 second intervals
3. Each second's data is saved as a CSV file in the hierarchical structure
4. When the file limit (120 files) is reached, oldest files are automatically removed
5. An aggregate CSV file is maintained with all current data
6. Frontend can access data through WebSocket connection

## File Structure

```
readings/
├── YYYY/
│   ├── MM/
│   │   ├── Week_N/
│   │   │   ├── DD/
│   │   │   │   ├── HHMMSS.csv
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
├── aggregate_data.csv
└── ...
```

## API Commands

The WebSocket server supports the following commands:

- `get_status`: Get current service status
- `start_collection`/`stop_collection`: Control data collection
- `get_file_list`: Get list of CSV files
- `get_csv_data`: Load specific CSV file data
- `get_recent_data`: Load recent data for display
- `export_all_csv_zip`: Export all CSV files as ZIP

## Installation

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Run the backend service:
   ```
   python main.py
   ```

## Deployment

### Automated Deployment

The backend is automatically deployed to server `172.168.4.70:2121` through GitHub Actions.

### Manual Deployment

1. **Using the deployment script:**
   ```bash
   cd backend
   ./deploy.sh
   ```

2. **For remote deployment:**
   ```bash
   cd backend
   SERVER_HOST=172.168.4.70 SERVER_USER=your_username ./deploy.sh remote
   ```

### Service Management

The backend runs as a systemd service:

- **Start service:** `sudo systemctl start wilo-backend`
- **Stop service:** `sudo systemctl stop wilo-backend`
- **Restart service:** `sudo systemctl restart wilo-backend`
- **Check status:** `sudo systemctl status wilo-backend`
- **View logs:** `sudo journalctl -u wilo-backend -f`

## Performance Considerations

- The system is optimized for Raspberry Pi hardware
- CPU affinity is set to dedicate a core for sensor collection
- Process priority is increased for better timing precision
- Direct I2C access is used for maximum sensor read speed