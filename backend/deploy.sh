#!/bin/bash
# Backend deployment script for Wilo Cloud Monitoring

set -e  # Exit on any error

echo "Starting Wilo Backend Deployment..."

# Check if we're on the target server or deploying remotely
if [[ "$1" == "remote" ]]; then
    if [[ -z "$SERVER_HOST" || -z "$SERVER_USER" ]]; then
        echo "Error: SERVER_HOST and SERVER_USER environment variables must be set for remote deployment"
        exit 1
    fi
    
    echo "Deploying to remote server: $SERVER_USER@$SERVER_HOST"
    
    # Create deployment package
    tar -czf /tmp/wilo-backend-deployment.tar.gz *.py requirements.txt config.json README.md
    
    # Copy to remote server
    scp /tmp/wilo-backend-deployment.tar.gz $SERVER_USER@$SERVER_HOST:/tmp/
    
    # Execute remote deployment
    ssh $SERVER_USER@$SERVER_HOST "bash -s" < deploy.sh
    
    # Clean up local deployment package
    rm /tmp/wilo-backend-deployment.tar.gz
    
    echo "Remote deployment completed!"
    exit 0
fi

# Local deployment steps
echo "Deploying backend locally..."

# Create deployment directory
sudo mkdir -p /opt/wilo-backend
sudo chown $USER:$USER /opt/wilo-backend

# If this is a remote deployment extraction
if [[ -f "/tmp/wilo-backend-deployment.tar.gz" ]]; then
    cd /opt/wilo-backend
    tar -xzf /tmp/wilo-backend-deployment.tar.gz
    rm /tmp/wilo-backend-deployment.tar.gz
fi

# Install Python dependencies
if [[ -f "requirements.txt" ]]; then
    pip3 install -r requirements.txt
else
    echo "Warning: requirements.txt not found"
fi

# Create systemd service file
sudo tee /etc/systemd/system/wilo-backend.service > /dev/null <<EOF
[Unit]
Description=Wilo Cloud Monitoring Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/wilo-backend
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and restart service
sudo systemctl daemon-reload
sudo systemctl restart wilo-backend.service
sudo systemctl enable wilo-backend.service

echo "Backend deployment completed successfully!"
echo "Service status:"
sudo systemctl status wilo-backend.service --no-pager -l