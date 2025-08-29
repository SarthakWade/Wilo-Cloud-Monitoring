# File-Generation-RPI

High-frequency sensor data collection system for Raspberry Pi with MPU6050 sensor, optimized for 800 Hz sampling rate.

## Project Overview

This system is designed for cloud-based condition monitoring and diagnostic health monitoring of machine tools. It achieves an impressive 800 Hz sampling rate from an MPU6050 sensor connected to a Raspberry Pi, making it suitable for high-precision vibration analysis and machine health monitoring.

## Features

- 🚀 **800 Hz Sampling Rate**: Optimized for high-frequency data collection
- 📡 **MPU6050 Integration**: Direct I2C communication with the sensor
- 📁 **Batch Processing**: Efficient file generation with timestamped CSV files
- 🎯 **Simulation Mode**: Development without hardware using simulated data
- 🔧 **Robust Error Handling**: Automatic reconnection and fallback mechanisms
- 📊 **Performance Testing**: Built-in tools to validate sampling rates
- ☁️ **Cloud Integration**: Automatic upload of data to cloud services
- 🔄 **Continuous Operation**: Systemd service for 24/7 operation
- 🌐 **RESTful API**: Web API for frontend integration
- 🖥️ **Web Dashboard**: Simple web interface for monitoring and control

## Technology Stack

- **Language**: Python 3.x
- **Hardware**: Raspberry Pi with MPU6050 sensor
- **Libraries**: 
  - pandas (2.2.2) - Data analysis
  - smbus (1.1.post2) - I2C communication
  - requests (2.32.3) - HTTP requests for cloud upload
  - python-dotenv (1.0.1) - Configuration management

## File Structure

```
File-Generation-RPI/
├── main.py              # Main orchestration script
├── mpu.py               # Optimized MPU6050 sensor class
├── files.py             # High-performance data collection (800 Hz)
├── api.py               # RESTful API for frontend integration
├── test_800hz.py        # Performance validation tool
├── test_backend.py      # Backend simulation for testing
├── frontend.html        # Simple web dashboard
├── requirements.txt     # Dependencies
├── deploy.sh            # Deployment script
├── sensor-monitor.service # Systemd service file
├── readings/            # CSV output files
├── uploaded_files/      # Files uploaded during testing (created automatically)
└── .env                 # Configuration file
```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd File-Generation-RPI
   ```

2. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

3. Connect MPU6050 sensor to Raspberry Pi:
   - VCC → 3.3V
   - GND → GND
   - SCL → GPIO 3 (SCL)
   - SDA → GPIO 2 (SDA)

4. Update `.env` with your WiFi credentials and cloud service configuration

## Usage

### Basic Data Collection

Collect sensor data at 800 Hz for 10 seconds:
```bash
python main.py --duration 10 --rate 800
```

### Continuous Operation

Run the system continuously, creating a new file every second:
```bash
python main.py --continuous --duration 1 --rate 800
```

### API Server

Start the system with API server for frontend integration:
```bash
python main.py --api --api-port 8000
```

### Performance Testing

Validate the actual sampling rate:
```bash
python test_800hz.py --duration 5
```

Benchmark different batch sizes:
```bash
python test_800hz.py --benchmark
```

### Data Analysis

Analyze a previously collected CSV file:
```bash
python main.py --analyze sensor_data_20230101_120000.csv
```

### Testing Cloud Upload

1. Start the backend simulation server:
   ```bash
   python test_backend.py
   ```

2. Update `.env` with:
   ```
   CLOUD_ENDPOINT=http://localhost:8080/api/data
   API_KEY=test_api_key
   ```

3. Run data collection to test upload:
   ```bash
   python main.py --duration 2
   ```

## Command Line Options

### main.py
- `--duration N`: Collection duration in seconds (default: 10)
- `--rate N`: Sampling rate in Hz (default: 800)
- `--batch N`: Batch size (default: 100)
- `--analyze FILE`: Analyze a specific CSV file
- `--continuous`: Run in continuous mode
- `--api`: Start API server
- `--api-port N`: API server port (default: 8000)

### test_800hz.py
- `--rate N`: Target sampling rate (default: 800)
- `--duration N`: Test duration in seconds (default: 5)
- `--benchmark`: Run batch size benchmark

## API Endpoints

The system provides a RESTful API for frontend integration:

### GET Endpoints
- `GET /api/status` - Get system status
- `GET /api/files` - List available data files
- `GET /api/file/{filename}` - Get specific data file content
- `GET /api/stats` - Get system statistics
- `GET /api/config` - Get current configuration
- `GET /health` - Health check endpoint

### POST Endpoints
- `POST /api/start` - Start data collection
- `POST /api/stop` - Stop continuous data collection
- `POST /api/config` - Update configuration

### API Request/Response Examples

Start continuous data collection:
```bash
curl -X POST http://localhost:8000/api/start \
  -H "Content-Type: application/json" \
  -d '{"continuous": true, "duration": 1}'
```

Get system status:
```bash
curl http://localhost:8000/api/status
```

## Performance Optimizations

1. **Precision Timing**: Uses conditional sleep with busy-wait for accurate intervals
2. **Batch Processing**: Collects 100 samples per batch to reduce I/O overhead
3. **Single-Axis Focus**: Optimized for Z-axis acceleration (configurable)
4. **Smart Error Handling**: Minimal retries for high-frequency operation
5. **Multi-Bus I2C Detection**: Automatic fallback and device discovery

## Output Files

Data is saved in the `readings/` directory as timestamped CSV files:
- Format: `sensor_data_YYYYMMDD_HHMMSS.csv`
- Columns: `timestamp`, `acceleration`

## Cloud Integration

The system can automatically upload collected data to a cloud service:
1. Configure `CLOUD_ENDPOINT` and `API_KEY` in `.env`
2. The system will attempt to upload each completed file
3. Uses Bearer token authentication

## Continuous Operation

For 24/7 operation, the system includes a systemd service:
1. Run `./deploy.sh` to set up the service
2. Start with: `sudo systemctl start sensor-monitor.service`
3. Enable at boot: `sudo systemctl enable sensor-monitor.service`
4. Check status: `sudo systemctl status sensor-monitor.service`

## Web Dashboard

The system includes a simple web dashboard for monitoring and control:
1. Start the system with API server: `python main.py --api`
2. Open `frontend.html` in a web browser
3. The dashboard will connect to the API server automatically

## Hardware Requirements

- Raspberry Pi (tested on Raspberry Pi 3B+ and 4B)
- MPU6050 accelerometer/gyroscope sensor
- Jumper wires for I2C connection

## Configuration

The `.env` file contains configuration options:
```
# WiFi Credentials (for future use)
WIFI_SSID=your_wifi_network_name
WIFI_PASSWORD=your_wifi_password

# Cloud Service Configuration
CLOUD_ENDPOINT=https://your-cloud-service.com/api/data
API_KEY=your_api_key_here
```

## Troubleshooting

- **Sensor not detected**: Check I2C connections and run `sudo i2cdetect -y 1`
- **Low sampling rate**: Ensure system is not under heavy load
- **Upload failures**: Verify cloud endpoint and API key in `.env`
- **Permission errors**: Ensure proper file permissions and user ownership
- **API connection issues**: Check if API server is running and firewall settings

## Future Enhancements

- Real-time data streaming to cloud services
- Advanced signal processing and filtering
- Multi-sensor support
- Web dashboard for real-time monitoring
- Machine learning-based anomaly detection

## License

This project is licensed under the MIT License - see the LICENSE file for details.