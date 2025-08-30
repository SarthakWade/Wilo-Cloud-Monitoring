#!/bin/bash
# Script to stop the complete Wilo-Cloud-Monitoring system

echo "🛑 Stopping Wilo-Cloud-Monitoring System"

# Kill backend processes
BACKEND_PIDS=$(ps aux | grep "main.py" | grep -v grep | awk '{print $2}')
if [ ! -z "$BACKEND_PIDS" ]; then
    echo "Stopping backend processes: $BACKEND_PIDS"
    kill $BACKEND_PIDS 2>/dev/null
else
    echo "No backend processes found"
fi

# Kill frontend processes
FRONTEND_PIDS=$(ps aux | grep "next-dev" | grep -v grep | awk '{print $2}')
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo "Stopping frontend processes: $FRONTEND_PIDS"
    kill $FRONTEND_PIDS 2>/dev/null
else
    echo "No frontend processes found"
fi

# Kill any remaining Node.js processes
NODE_PIDS=$(ps aux | grep "node.*next" | grep -v grep | awk '{print $2}')
if [ ! -z "$NODE_PIDS" ]; then
    echo "Stopping Node.js processes: $NODE_PIDS"
    kill $NODE_PIDS 2>/dev/null
fi

echo "System stopped!"