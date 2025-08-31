#!/bin/bash
# 🚀 WILO System Startup Script

echo "🌟 Starting WILO Sensor Dashboard System..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    netstat -tlnp 2>/dev/null | grep -q ":$1 "
}

echo -e "${BLUE}🔍 System Check...${NC}"

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python3 not found${NC}"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

# Check I2C
if [ -e /dev/i2c-1 ]; then
    echo -e "${GREEN}✅ I2C interface available${NC}"
else
    echo -e "${YELLOW}⚠️  I2C interface not found - sensor may not work${NC}"
fi

# Check if ports are available
if port_in_use 8765; then
    echo -e "${YELLOW}⚠️  Port 8765 already in use (WebSocket)${NC}"
fi

if port_in_use 3000; then
    echo -e "${YELLOW}⚠️  Port 3000 already in use (Frontend)${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Starting Backend Service...${NC}"

# Start backend in background
cd backend
python3 backend_service.py &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Backend service started (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}❌ Backend service failed to start${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🌐 Starting Frontend Service...${NC}"

# Start frontend
cd ../frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Build if needed
if [ ! -d ".next" ]; then
    echo -e "${YELLOW}🔨 Building frontend...${NC}"
    npm run build
fi

# Start frontend
npm start &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend service started (PID: $FRONTEND_PID)${NC}"
else
    echo -e "${RED}❌ Frontend service failed to start${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 WILO System Started Successfully!${NC}"
echo "========================================"
echo -e "${BLUE}📊 Dashboard URL:${NC} http://localhost:3000"
echo -e "${BLUE}🔌 WebSocket:${NC} ws://localhost:8765"
echo -e "${BLUE}📁 CSV Data:${NC} backend/readings/"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "  • Press Ctrl+C to stop both services"
echo "  • Check 'backend/readings/' for CSV files"
echo "  • Use the Browse button to explore data"
echo "  • Adjust sampling rate in real-time"
echo ""
echo -e "${BLUE}🔍 Process IDs:${NC}"
echo "  Backend PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✅ Services stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for user to stop
echo -e "${GREEN}✨ System running... Press Ctrl+C to stop${NC}"
wait