#!/bin/bash

echo "🛑 Stopping Fashion Search App..."

# Stop search API
if [ -f ".search-api.pid" ]; then
    PID=$(cat .search-api.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✅ Stopped Search API (PID: $PID)"
    fi
    rm .search-api.pid
fi

# Stop frontend
if [ -f ".frontend.pid" ]; then
    PID=$(cat .frontend.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "✅ Stopped Frontend (PID: $PID)"
    fi
    rm .frontend.pid
fi

# Fallback: kill by port
lsof -ti:3000 | xargs kill 2>/dev/null
lsof -ti:8080 | xargs kill 2>/dev/null

echo "✨ All servers stopped!"
