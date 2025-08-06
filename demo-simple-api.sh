#!/bin/bash

# Demo script to test the simple API server endpoints
# Make sure to run the server first: npm run simple-server

echo "🚀 Testing Simple API Server"
echo "============================"
echo ""

BASE_URL="http://localhost:3000"

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.' || echo "Health endpoint failed"
echo ""

# Test user registration
echo "2. Testing user registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "testpassword123"
  }')

echo "$REGISTER_RESPONSE" | jq '.' || echo "Registration failed"

# Extract token from registration response
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token from registration"
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."
echo ""

# Test user login
echo "3. Testing user login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }')

echo "$LOGIN_RESPONSE" | jq '.' || echo "Login failed"
echo ""

# Test getting apps (should be empty)
echo "4. Testing get apps (should be empty)..."
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/apps" | jq '.' || echo "Get apps failed"
echo ""

# Test generating an app
echo "5. Testing app generation..."
GENERATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a todo list app"
  }')

echo "$GENERATE_RESPONSE" | jq '.' || echo "App generation failed"

# Extract app ID from generation response
APP_ID=$(echo "$GENERATE_RESPONSE" | jq -r '.app.id // empty')

if [ ! -z "$APP_ID" ]; then
  echo "✅ Generated app with ID: $APP_ID"
  echo ""

  # Test getting specific app
  echo "6. Testing get specific app..."
  curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/apps/$APP_ID" | jq '.' || echo "Get specific app failed"
  echo ""

  # Test getting all apps (should now have one)
  echo "7. Testing get all apps (should have one)..."
  curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/apps" | jq '.' || echo "Get apps failed"
  echo ""

  # Test deleting the app
  echo "8. Testing app deletion..."
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/apps/$APP_ID" | jq '.' || echo "Delete app failed"
  echo ""
else
  echo "❌ No app ID received from generation"
fi

# Test 404 endpoint
echo "9. Testing 404 endpoint..."
curl -s "$BASE_URL/nonexistent" | jq '.' || echo "404 test failed"
echo ""

# Test rate limiting (try to hit registration multiple times)
echo "10. Testing rate limiting (may take a moment)..."
for i in {1..6}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test$i@example.com\",\"name\":\"Test$i\",\"password\":\"test123\"}")
  echo "  Registration attempt $i: HTTP $STATUS"
done
echo ""

echo "🎉 Demo complete!"
echo ""
echo "🔧 Server logs should show all requests and any errors"