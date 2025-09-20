# Wilo Cloud Monitoring Backend

This backend service collects high-frequency sensor data from an MPU6050 accelerometer at up to 850 Hz and stores it in CSV files.

## Features

- Collects sensor readings at up to 850 Hz using optimized direct I2C access
- Creates separate CSV files for each second of data
- Stores files in a hierarchical directory structure
- Aggregates data every 2 hours into summary files
- Identifies maximum acceleration readings

## Directory Structure

```
readings/
├── 2025/
│   ├── 04/
│   │   ├── 15/
│   │   │   ├── 10/
│   │   │   │   ├── 3045.csv  # 30:45 timestamp
│   │   │   │   └── 3046.csv  # 30:46 timestamp
│   │   │   └── 11/
│   │   │       ├── 0001.csv
│   │   │       └── 0002.csv
├── aggregate_readings.csv    # Aggregated data from last 2 hours
└── max_reading.csv           # Maximum acceleration reading from last 2 hours
```

## Requirements

- Python 3.7+
- MPU6050 sensor connected via I2C
- Required Python packages:
  - mpu6050-raspberrypi
  - smbus2
  - psutil

Install requirements:
```bash
pip install -r requirements.txt
```

## Configuration

The [config.json](file://config.json) file contains all configuration parameters:

- `sensor.i2c_address`: I2C address of the MPU6050 sensor (default: 0x68)
- `sensor.sampling_rate`: Data collection rate in Hz (default: 800)
- `csv.readings_directory`: Directory to store CSV files (default: readings)
- `csv.aggregate_filename`: Name of the aggregate CSV file (default: aggregate_readings.csv)
- `csv.max_reading_filename`: Name of the maximum reading CSV file (default: max_reading.csv)
- `processing.aggregation_interval_hours`: Hours between aggregations (default: 2)

## Usage

### High-Speed Sensor Reading
For real-time sensor data display in terminal:
```bash
python sensor.py [target_rate]
```

Examples:
```bash
python sensor.py        # Run at default 800 Hz
python sensor.py 850    # Run at 850 Hz
```

### Full Backend Service
To run the complete backend service that saves data to CSV files:
```bash
python main.py
```

Or with a custom configuration file:
```bash
python main.py --config /path/to/config.json
```

### System Optimizations
To maximize sampling rate, apply system-level optimizations:
```bash
sudo ./overclock_setup.sh
sudo reboot
```

See [HIGH_SPEED_READING.md](file:///home/willo/Desktop/Wilo-Cloud-Monitoring/backend/HIGH_SPEED_READING.md) for details on optimizations.

## Data Format

Each CSV file contains the following columns:
- `timestamp`: ISO format timestamp with millisecond precision
- `x`: Acceleration in X-axis (m/s²)
- `y`: Acceleration in Y-axis (m/s²)
- `z`: Acceleration in Z-axis (m/s²)
- `total`: Combined acceleration magnitude (m/s²)

## Aggregation Files

Every 2 hours, the system generates two summary files:

1. `aggregate_readings.csv`: Contains all readings from the past 2 hours (7200 files)
2. `max_reading.csv`: Contains the maximum acceleration value and its source file

## Performance Optimization

The system implements several optimizations to achieve high sampling rates:

1. **Direct I2C Register Access**: Bypasses library overhead for faster data reading
2. **Precise Timing Control**: Uses high-resolution timers and adaptive sleep strategies
3. **Reduced I/O Overhead**: Minimizes terminal output during high-speed operation
4. **System-Level Tuning**: CPU performance mode and increased I2C bus speed

For detailed information on optimizations, see [HIGH_SPEED_READING.md](file:///home/willo/Desktop/Wilo-Cloud-Monitoring/backend/HIGH_SPEED_READING.md).