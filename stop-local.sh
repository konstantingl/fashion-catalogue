#!/bin/bash

echo "🛑 Stopping Fashion Search App..."

# Read PID from file
if [ -f ".search-api.pid" ]; then
    PID=$(cat .search-api.pid)

    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping Search API (PID: $PID)..."
        kill $PID
        echo "✅ Search API stopped"
    else
        echo "⚠️  Search API is not running (PID: $PID)"
    fi

    rm .search-api.pid
else
    echo "⚠️  No PID file found"
    echo "Trying to find and stop node processes on port 3000..."

    # Try to find process using port 3000
    PORT_PID=$(lsof -ti:3000)
    if [ ! -z "$PORT_PID" ]; then
        echo "Found process on port 3000 (PID: $PORT_PID)"
        kill $PORT_PID
        echo "✅ Stopped process on port 3000"
    else
        echo "No process found on port 3000"
    fi
fi

echo "✨ Done!"
