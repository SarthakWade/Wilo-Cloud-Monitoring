# Wilo-Cloud-Monitoring System Usage Guide

## System Architecture

The Wilo-Cloud-Monitoring system consists of two main components:

1. **Backend** (Python): Data collection and API server
2. **Frontend** (Next.js/React): Web-based dashboard for data visualization

## Starting the System

### Method 1: Using the startup script (Recommended)

```bash
# Start the complete system
./start_system.sh

# Stop the system when finished
./stop_system.sh
```

### Method 2: Manual startup

1. Start the backend API server:
   ```bash
   cd Backend
   python3 main.py --api --api-port 8000
   ```

2. In a separate terminal, start the frontend:
   ```bash
   cd Frontend
   npm run dev
   ```

## Accessing the System

Once both servers are running:

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:8000

## Data Flow

1. Backend collects sensor data and stores it as CSV files in the `Backend/readings/` directory
2. The `sync_frontend_data.py` script converts CSV files to JSON format
3. Converted JSON files are stored in `Frontend/public/data/`
4. Frontend fetches data from `/data/*.json` endpoints
5. Next.js configuration proxies data requests to the backend API when needed

## API Endpoints

### Backend API (http://localhost:8000)

- `GET /health` - Health check
- `GET /api/status` - System status
- `GET /api/files` - List available data files
- `GET /api/file/{filename}` - Get specific data file
- `GET /api/stats` - System statistics
- `POST /api/start` - Start data collection
- `POST /api/stop` - Stop data collection

## Synchronizing Data

To manually sync data from backend to frontend:

```bash
cd Backend
python3 sync_frontend_data.py
```

## System Maintenance

### Adding New Data Files

1. Place new CSV files in `Backend/readings/`
2. Run the sync script: `python3 sync_frontend_data.py`
3. Refresh the frontend dashboard

### Configuration

- Backend configuration: Command-line arguments to `main.py`
- Frontend configuration: `Frontend/next.config.ts`

## Troubleshooting

### If the system doesn't start:

1. Check if required ports (8000, 3000) are available
2. Verify Python dependencies are installed: `pip install -r Backend/requirements.txt`
3. Verify Node.js dependencies are installed: `cd Frontend && npm install`

### If data doesn't appear in the frontend:

1. Run the sync script: `cd Backend && python3 sync_frontend_data.py`
2. Check if CSV files exist in `Backend/readings/`
3. Verify the backend API is running: `curl http://localhost:8000/health`

## Development

### Backend Development

- Main entry point: `Backend/main.py`
- API implementation: `Backend/api.py`
- Data collection: `Backend/files.py`

### Frontend Development

- Main page: `Frontend/src/app/page.tsx`
- Dashboard component: `Frontend/src/components/Dashboard.tsx`
- Data files: `Frontend/public/data/`

## Testing

Run the system test script:

```bash
python3 test_system.py
```