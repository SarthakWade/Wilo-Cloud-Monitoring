#!/bin/bash
# Simple script to find the IP address of the current machine

echo "Finding IP addresses for this machine..."
echo "======================================"

# Try different methods to find IP address

echo "Method 1: Using hostname -I"
if command -v hostname &> /dev/null; then
    IPS=$(hostname -I 2>/dev/null)
    if [ ! -z "$IPS" ]; then
        echo "Local IP addresses: $IPS"
    else
        echo "No IP addresses found with hostname -I"
    fi
else
    echo "hostname command not available"
fi

echo ""
echo "Method 2: Using ip command"
if command -v ip &> /dev/null; then
    echo "Network interfaces and IP addresses:"
    ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2 " on " $NF}'
else
    echo "ip command not available"
fi

echo ""
echo "Method 3: Using ifconfig (if available)"
if command -v ifconfig &> /dev/null; then
    echo "Network interfaces (ifconfig):"
    ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}'
else
    echo "ifconfig command not available"
fi

echo ""
echo "To use with Wilo Cloud Monitoring:"
echo "1. Use one of the IP addresses above for the backend machine"
echo "2. On the frontend machine, set the environment variable:"
echo "   export NEXT_PUBLIC_BACKEND_HOST=<backend-ip-address>"
echo "3. Start the frontend with: bun run dev"