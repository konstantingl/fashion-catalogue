#!/bin/bash

echo "======================================"
echo "🚀 Launching Fashion Search App"
echo "======================================"
echo ""

# Change to project directory
cd "$(dirname "$0")"

# Start Search API
echo "🔍 Starting Search Engine API (port 3000)..."
cd search_engine_v2
npm run dev > ../search-api.log 2>&1 &
SEARCH_PID=$!
cd ..

# Wait for API
sleep 3

# Check API
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Search API running (PID: $SEARCH_PID)"
else
    echo "❌ Search API failed to start"
    exit 1
fi

# Start Frontend Server
echo "🎨 Starting Frontend Server (port 8080)..."
python3 -m http.server 8080 > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend
sleep 2

# Check frontend
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Frontend server running (PID: $FRONTEND_PID)"
else
    echo "❌ Frontend server failed to start"
    exit 1
fi

# Save PIDs
echo "$SEARCH_PID" > .search-api.pid
echo "$FRONTEND_PID" > .frontend.pid

echo ""
echo "======================================"
echo "✨ App is ready!"
echo "======================================"
echo ""
echo "Frontend:   http://localhost:8080"
echo "Search API: http://localhost:3000"
echo ""
echo "Opening app in browser..."
open http://localhost:8080

echo ""
echo "To stop the app:"
echo "  ./stop-app.sh"
echo ""
echo "Logs:"
echo "  Search API: tail -f search-api.log"
echo "  Frontend:   tail -f frontend.log"
echo ""
