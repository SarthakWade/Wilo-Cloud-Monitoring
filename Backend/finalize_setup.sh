#!/bin/bash

# Finalize setup script for Wilo-Cloud-Monitoring system

echo "Finalizing Wilo-Cloud-Monitoring system setup..."

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "Warning: This script is designed for Raspberry Pi systems."
fi

# Create necessary directories
mkdir -p readings
mkdir -p uploaded_files

# Check if virtual environment exists
if [ ! -d "env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv env
fi

# Activate virtual environment
source env/bin/activate

# Install/upgrade dependencies
echo "Installing/upgrading dependencies..."
pip install -r requirements.txt

# Create systemd service file
echo "Creating systemd service file..."
sudo tee /etc/systemd/system/sensor-monitor.service > /dev/null <<EOF
[Unit]
Description=High-Frequency Sensor Data Collection Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/nvs/Desktop/Wilo-Cloud-Monitoring
ExecStart=/home/nvs/Desktop/Wilo-Cloud-Monitoring/env/bin/python main.py --continuous --duration 1 --rate 800 --batch 100 --api --api-port 8000
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "Reloading systemd..."
sudo systemctl daemon-reload

# Enable the service
echo "Enabling sensor-monitor service..."
sudo systemctl enable sensor-monitor.service

echo ""
echo "Setup complete!"
echo ""
echo "To start the service, run:"
echo "sudo systemctl start sensor-monitor.service"
echo ""
echo "To check the service status, run:"
echo "sudo systemctl status sensor-monitor.service"
echo ""
echo "The system will now:"
echo "1. Continuously collect sensor data at 800 Hz"
echo "2. Create a new file every second"
echo "3. Provide a RESTful API on port 8000 for frontend integration"
echo "4. Automatically restart if it encounters any issues"
echo ""
echo "API endpoints available at http://localhost:8000/api/"
echo "Frontend dashboard available in frontend.html"
echo ""
echo "IMPORTANT: Please update the .env file with your actual cloud service configuration."