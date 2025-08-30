#!/bin/bash
# Script to start the complete Wilo-Cloud-Monitoring system

echo "🚀 Starting Wilo-Cloud-Monitoring System"

# Start backend API server in background
echo "Starting backend API server..."
cd /home/nvs/Desktop/Wilo/Wilo-Cloud-Monitoring/Backend
nohup python3 main.py --api --api-port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend API server started with PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 3

# Start frontend server in background
echo "Starting frontend server..."
cd /home/nvs/Desktop/Wilo/Wilo-Cloud-Monitoring/Frontend
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo "System startup complete!"
echo "Backend logs: /home/nvs/Desktop/Wilo/Wilo-Cloud-Monitoring/Backend/backend.log"
echo "Frontend logs: /home/nvs/Desktop/Wilo/Wilo-Cloud-Monitoring/Frontend/frontend.log"
echo "Frontend will be available at: http://localhost:3000"
echo "Backend API will be available at: http://localhost:8000"

# Show running processes
echo "Running processes:"
ps -p $BACKEND_PID -p $FRONTEND_PID -o pid,ppid,cmd --no-headers 2>/dev/null || echo "Some processes may have exited"

echo "Use 'stop_system.sh' to stop the system when finished."