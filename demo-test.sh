#!/bin/bash

echo "🚀 AI App Generator POC - End-to-End Demo"
echo "========================================="
echo ""

# Check if API server is running
echo "1️⃣ Checking API Server..."
API_HEALTH=$(curl -s http://localhost:3002/health 2>/dev/null)
if [[ "$API_HEALTH" == *"ok"* ]]; then
    echo "✅ API Server is running on port 3002"
else
    echo "❌ API Server is not running. Please start it with: bun run server/api-server.ts"
    exit 1
fi

# Check database stats
echo ""
echo "2️⃣ Database Statistics:"
curl -s http://localhost:3002/api/stats | python3 -m json.tool

# Create a new todo via API
echo ""
echo "3️⃣ Creating a new todo item via API..."
NEW_TODO=$(curl -s -X POST http://localhost:3002/api/data/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Demo Task", "description": "Created by demo script"}')
echo "Created: $NEW_TODO"

# List all todos
echo ""
echo "4️⃣ All todos in database:"
curl -s http://localhost:3002/api/data/todos | python3 -m json.tool

# Get saved apps
echo ""
echo "5️⃣ Saved apps:"
curl -s http://localhost:3002/api/apps | python3 -m json.tool | head -20

echo ""
echo "✅ End-to-end test complete!"
echo ""
echo "The system demonstrates:"
echo "  • SQLite database persistence"
echo "  • REST API for CRUD operations"
echo "  • Dynamic app generation"
echo "  • Module federation concept (component loading)"
echo "  • Client-side state management"
echo ""
echo "To see it in action:"
echo "  1. The iOS app is running in the simulator"
echo "  2. Type 'Create a todo list app' and tap Generate"
echo "  3. Add tasks using the form"
echo "  4. Tasks are persisted in the SQLite database"
echo "  5. Pull down to refresh the list"