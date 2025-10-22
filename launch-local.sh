#!/bin/bash

echo "======================================"
echo "🚀 Launching Fashion Search App Locally"
echo "======================================"
echo ""

# Check if search engine dependencies are installed
if [ ! -d "search_engine_v2/node_modules" ]; then
    echo "📦 Installing search engine dependencies..."
    cd search_engine_v2
    npm install
    cd ..
    echo "✅ Dependencies installed"
    echo ""
fi

# Start the search engine API server in background
echo "🔍 Starting Search Engine API on port 3000..."
cd search_engine_v2
npm run dev > ../search-api.log 2>&1 &
SEARCH_PID=$!
cd ..

# Wait for API to be ready
echo "⏳ Waiting for API to start..."
sleep 3

# Check if API is running
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Search Engine API is running (PID: $SEARCH_PID)"
else
    echo "❌ Search Engine API failed to start"
    echo "Check search-api.log for errors"
    exit 1
fi

echo ""
echo "======================================"
echo "✨ App is ready!"
echo "======================================"
echo ""
echo "Frontend: Open index.html in your browser"
echo "   → file://$(pwd)/index.html"
echo ""
echo "Search API: http://localhost:3000"
echo "   → Health check: http://localhost:3000/health"
echo ""
echo "To stop the search API:"
echo "   kill $SEARCH_PID"
echo ""
echo "API logs: tail -f search-api.log"
echo ""
echo "======================================"
echo ""

# Save PID for later
echo $SEARCH_PID > .search-api.pid

echo "Opening index.html in browser..."
if command -v open &> /dev/null; then
    open index.html
elif command -v xdg-open &> /dev/null; then
    xdg-open index.html
else
    echo "Please open index.html manually in your browser"
fi
