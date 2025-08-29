#!/bin/bash
# Script to sync backend data to frontend
# This should be run periodically to keep frontend data up to date

cd /home/nvs/Desktop/Wilo/Wilo-Cloud-Monitoring/Backend
python3 sync_frontend_data.py

echo "Frontend data sync completed at $(date)"