#!/bin/bash

# Deployment script for Wilo-Cloud-Monitoring system

echo "Starting deployment of Wilo-Cloud-Monitoring system..."

# Check if running on Raspberry Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "Warning: This script is designed for Raspberry Pi systems."
    echo "Proceeding anyway..."
fi

# Create virtual environment if it doesn't exist
if [ ! -d "env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv env
fi

# Activate virtual environment
source env/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create readings directory if it doesn't exist
mkdir -p readings

# Set up systemd service
echo "Setting up systemd service..."
sudo cp sensor-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sensor-monitor.service

echo "Deployment complete!"
echo ""
echo "To start the service, run:"
echo "sudo systemctl start sensor-monitor.service"
echo ""
echo "To check the service status, run:"
echo "sudo systemctl status sensor-monitor.service"
echo ""
echo "To view logs, run:"
echo "sudo journalctl -u sensor-monitor.service -f"
echo ""
echo "IMPORTANT: Please update the .env file with your actual WiFi credentials and cloud service configuration."