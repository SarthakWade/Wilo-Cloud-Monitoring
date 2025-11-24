# Cloud Monitoring Service

A real-time cloud monitoring dashboard for sensor data analysis with comprehensive statistical parameter calculation and visualization.

## Features

- **Three Independent Charts**: Simultaneous visualization of different statistical parameters
- **Real-time Updates**: Live data streaming via Socket.IO
- **Comprehensive Statistics**: 21+ statistical parameters including amplitude, health ratios, and distribution features
- **Modern UI**: React + TailwindCSS with dark/light theme support
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Architecture

- **Backend**: Flask API with Socket.IO for real-time communication
- **Frontend**: React + Vite + TailwindCSS
- **Charts**: Chart.js with react-chartjs-2
- **Data Processing**: NumPy + SciPy for statistical calculations

## Statistical Parameters

### Basic Amplitude Statistics
- Max, Min, Mean, Absolute Mean
- RMS, Variance, Standard Deviation
- Peak, Peak-to-Peak

### Severity / Health Ratios
- Crest Factor, Impulse Factor
- Shape Factor, Clearance Factor

### Distribution Features
- Skewness, Kurtosis, Excess Kurtosis

### Additional Parameters
- Energy, Zero-Crossing Rate
- Percentiles (90th, 95th, 99th)

## Installation

### Backend Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
bun install  # or npm install
```

## Usage

### Start Backend
```bash
source venv/bin/activate
python app.py
# Runs on http://localhost:5000
```

### Start Frontend
```bash
cd frontend
bun run dev  # or npm run dev
# Runs on http://localhost:5173
```

### Production Build
```bash
cd frontend
bun run build  # or npm run build
# Creates optimized build in dist/
```

## Data Format

The system expects CSV files with the following formats:

**Format 1** (Legacy):
```csv
timestamp,z
1000.0,0.1
1001.0,0.2
```

**Format 2** (ISO Timestamps):
```csv
timestamp,value
2025-11-24T21:26:22.463,6.508702
2025-11-24T21:26:22.464,1.497415
```

## API Endpoints

- `GET /files` - List all CSV files
- `GET /parameter-data/<parameter>` - Get time-series data for specific parameter
- `GET /chart-data` - Get complete chart data with statistics
- `GET /view/<filename>` - View CSV file contents

## Configuration

Edit `config.json` to adjust monitoring settings:
```json
{
  "interval_seconds": 300
}
```

## File Monitoring

The system automatically monitors the `Data/` directory for new CSV files matching the pattern `max_reading*.csv` and updates charts in real-time.

## Development

### Project Structure
```
├── app.py                 # Flask backend API
├── config.json           # Configuration settings
├── requirements.txt      # Python dependencies
├── frontend/             # React application
│   ├── src/
│   │   ├── App.jsx      # Main React component
│   │   ├── index.css    # Styles with TailwindCSS
│   │   └── main.jsx     # React entry point
│   └── package.json     # Frontend dependencies
├── Data/                # CSV data files (auto-created)
└── Server/              # Additional server utilities
```

### Adding New Parameters

To add new statistical parameters:

1. Update the `calculate_statistics()` function in `app.py`
2. Add the parameter to the appropriate options array in `App.jsx`
3. Update the parameter label mapping in `getParameterLabel()`

## License

This project is licensed under the MIT License.
