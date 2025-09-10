# Wilo Cloud Monitoring Deployment Guide

## Quick Start Commands

### Run Backend (Development)
```bash
cd /home/willo/Desktop/Wilo/Wilo-Cloud-Monitoring/backend && source ../venv/bin/activate && python3 main.py
```

### Run Frontend (Development)
```bash
cd /home/willo/Desktop/Wilo/Wilo-Cloud-Monitoring/frontend && source ~/.bashrc && bun run dev
```

## Hardware Connections

MPU6050 Sensor Connections to Raspberry Pi:

- VCC (RED): Connect to Pin 4 (5V) on the Raspberry Pi
- GND (BROWN): Connect to Pin 6 (Ground) on the Raspberry Pi
- SCL (WHITE): Connect to Pin 5 (SCL) on the Raspberry Pi
- SDA (BLACK): Connect to Pin 3 (SDA) on the Raspberry Pi

## Network Setup

For running frontend and backend on the same WiFi network:

1. Identify the backend machine's IP address
2. Configure the frontend to connect to the backend using one of these methods:
   - Set the `NEXT_PUBLIC_BACKEND_HOST` environment variable
   - Create a `.env.local` file in the frontend directory with the backend IP
3. Start both services

See [NETWORK_SETUP.md](NETWORK_SETUP.md) for detailed instructions.

## Production Deployment

### Frontend Deployment

The frontend is automatically deployed to GitHub Pages through GitHub Actions.

### Backend Deployment

The backend is deployed to server `172.168.4.70:2121` through GitHub Actions.

For manual deployment, use the deployment script:
```bash
cd backend
./deploy.sh
```

For more detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).