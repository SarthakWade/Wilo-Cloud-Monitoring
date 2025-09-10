# Network Setup Guide for Wilo Cloud Monitoring

## Overview

This guide explains how to run both the frontend and backend components of the Wilo Cloud Monitoring system on the same WiFi network.

## Prerequisites

1. Both frontend and backend machines connected to the same WiFi network
2. Backend machine has Python 3.9+ installed
3. Frontend machine has Node.js and Bun installed
4. Both machines can communicate over the network (ports 8765 and 8766 open)

## Setup Instructions

### 1. Identify Backend Machine IP Address

On the backend machine, find its IP address:

```bash
# On Linux/macOS
ip addr show | grep "inet " | grep -v 127.0.0.1

# On Windows
ipconfig

# Or use hostname command
hostname -I
```

You can also use the provided script:
```bash
cd /home/willo/Desktop/Wilo-Cloud-Monitoring
./find_ip.sh
```

### 2. Configure Backend

The backend is already configured to listen on all interfaces (`0.0.0.0`) on port 8765.

To start the backend:

```bash
cd /home/willo/Desktop/Wilo-Cloud-Monitoring/backend
source venv/bin/activate  # If using virtual environment
python main.py
```

### 3. Configure Frontend

You can configure the backend IP address in several ways:

#### Option 1: Using .env.local file (Recommended)
Create or edit `/home/willo/Desktop/Wilo-Cloud-Monitoring/frontend/.env.local`:
```
NEXT_PUBLIC_BACKEND_HOST=192.168.1.100
```

#### Option 2: Environment variable
```bash
# Replace 192.168.1.100 with your actual backend IP address
export NEXT_PUBLIC_BACKEND_HOST=192.168.1.100

cd /home/willo/Desktop/Wilo-Cloud-Monitoring/frontend
bun run dev
```

#### Option 3: Direct command line
```bash
cd /home/willo/Desktop/Wilo-Cloud-Monitoring/frontend
NEXT_PUBLIC_BACKEND_HOST=192.168.1.100 bun run dev
```

### 4. Access the Application

Once both frontend and backend are running:

1. Open a web browser
2. Navigate to `http://frontend-machine-ip:3000`
3. The frontend should automatically connect to the backend

## Troubleshooting

### Connection Issues

1. **Check network connectivity:**
   ```bash
   ping <backend-ip-address>
   ```

2. **Verify backend is running:**
   ```bash
   netstat -tlnp | grep :8765
   ```

3. **Check firewall settings:**
   ```bash
   # On Ubuntu/Debian
   sudo ufw status
   
   # Allow required ports
   sudo ufw allow 8765
   sudo ufw allow 8766
   ```

### Common Issues

1. **WebSocket connection failed:**
   - Ensure the backend IP address is correctly set in the frontend
   - Check that the backend is actually running
   - Verify that port 8765 is not blocked by firewall

2. **Frontend not loading:**
   - Ensure Bun is properly installed
   - Check that port 3000 is not blocked by firewall

3. **No sensor data:**
   - Ensure the MPU6050 sensor is properly connected
   - Check I2C connections on the Raspberry Pi
   - Verify sensor is detected: `i2cdetect -y 1`

## Port Information

- **8765**: WebSocket connection for real-time data
- **8766**: HTTP server for file downloads
- **3000**: Frontend development server

## Security Considerations

When running on a network, consider:

1. Only expose the necessary ports
2. Use strong network security (WPA2/WPA3)
3. Consider adding authentication for production use
4. Regularly update dependencies

## Testing Network Setup

To verify the network setup is working:

1. Start the backend and note its IP address
2. Set the `NEXT_PUBLIC_BACKEND_HOST` environment variable on the frontend machine
3. Start the frontend
4. Open the frontend in a browser from another machine on the same network
5. Check the browser console for WebSocket connection messages