# Wilo Cloud Monitoring Deployment Guide

## Overview

This guide explains how to deploy both the frontend and backend components of the Wilo Cloud Monitoring system.

## Frontend Deployment

The frontend is deployed to GitHub Pages automatically through GitHub Actions when changes are pushed to the `master` branch.

### Manual Frontend Deployment

```bash
cd frontend
bun install
bun run build
```

## Backend Deployment

The backend is deployed to a dedicated server at `172.168.4.70:2121`.

### Automated Deployment

The backend is automatically deployed through GitHub Actions when changes are pushed to the `master` branch.

### Manual Backend Deployment

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

### Backend Service Management

The backend runs as a systemd service:

- **Start service:** `sudo systemctl start wilo-backend`
- **Stop service:** `sudo systemctl stop wilo-backend`
- **Restart service:** `sudo systemctl restart wilo-backend`
- **Check status:** `sudo systemctl status wilo-backend`
- **View logs:** `sudo journalctl -u wilo-backend -f`

### Server Requirements

- Python 3.9+
- Systemd (for service management)
- SSH access for deployment

### Required GitHub Secrets

For automated deployment, the following secrets must be configured in the GitHub repository:

- `SERVER_USERNAME`: Username for SSH access to the server
- `SERVER_SSH_KEY`: Private SSH key for authentication

## Directory Structure

After deployment:

```
/opt/wilo-backend/
├── config.json
├── deploy.sh
├── high_speed_sensor_service.py
├── high_speed_websocket_server.py
├── main.py
├── new_backend_service.py
├── README.md
├── requirements.txt
└── test_backend.py
```

## Configuration

The backend configuration can be modified in `/opt/wilo-backend/config.json`:

```json
{
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
```

## Troubleshooting

### Backend Service Issues

1. Check service status:
   ```bash
   sudo systemctl status wilo-backend
   ```

2. View logs:
   ```bash
   sudo journalctl -u wilo-backend -f
   ```

3. Check if required ports are available:
   ```bash
   netstat -tlnp | grep :8765
   netstat -tlnp | grep :8766
   ```

### Sensor Connection Issues

1. Verify I2C is enabled on the Raspberry Pi:
   ```bash
   ls /dev/i2c*
   ```

2. Check sensor connection:
   ```bash
   i2cdetect -y 1
   ```

### Network Issues

1. Verify the server is accessible:
   ```bash
   ping 172.168.4.70
   ```

2. Check if required ports are open:
   ```bash
   telnet 172.168.4.70 2121
   ```