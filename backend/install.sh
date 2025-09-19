#!/bin/bash

# Wilo Cloud Monitoring Backend Installation Script

echo "Installing Wilo Cloud Monitoring Backend..."

# Install required packages
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "Creating directories..."
mkdir -p readings

# Set up systemd service (optional)
echo "To install as a systemd service:"
echo "  sudo cp wilo-monitoring.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable wilo-monitoring.service"
echo "  sudo systemctl start wilo-monitoring.service"

echo "Installation complete!"
echo ""
echo "To run the backend manually:"
echo "  python main.py"
echo ""
echo "The backend will:"
echo "  - Collect sensor data at 800 Hz"
echo "  - Create CSV files every second in the readings/ directory"
echo "  - Aggregate data every 2 hours"
echo "  - Generate maximum reading reports"