#!/bin/bash

echo "=== 0G Compute Chat API Test ==="

# 1) Проверяем ENV переменные
echo "1. Checking environment variables:"
echo "NEXT_PUBLIC_0G_RPC_URL: ${NEXT_PUBLIC_0G_RPC_URL:-'Not set'}"
echo "OG_COMPUTE_PRIVATE_KEY: ${OG_COMPUTE_PRIVATE_KEY:0:10}... (truncated for security)"
echo ""

# 2) Type-check & build
echo "2. Running type-check and build:"
cd web
echo "Running pnpm type-check..."
pnpm type-check
if [ $? -ne 0 ]; then
    echo "❌ Type-check failed!"
    exit 1
fi
echo "✅ Type-check passed!"

echo "Running pnpm build..."
pnpm build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi
echo "✅ Build passed!"

# 3) Start dev server in background for testing
echo ""
echo "3. Starting dev server for testing..."
pnpm dev &
DEV_PID=$!
echo "Dev server started with PID: $DEV_PID"

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# 4) Test API call
echo ""
echo "4. Testing chat API call:"
echo "Making request to http://localhost:3000/api/compute/chat"

RESPONSE=$(curl -s -X POST http://localhost:3000/api/compute/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello, how are you?","agentMetadata":{"name":"TestAgent","description":"A helpful test agent for demonstration"}}')

echo "Response received:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# 5) Check response structure
echo ""
echo "5. Validating response structure:"
if echo "$RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    echo "✅ Response has 'success' field"
else
    echo "❌ Response missing 'success' field"
fi

if echo "$RESPONSE" | jq -e '.metadata.timing.totalTTFB' >/dev/null 2>&1; then
    echo "✅ Response has timing metadata"
    TTFB=$(echo "$RESPONSE" | jq -r '.metadata.timing.totalTTFB')
    echo "   Total TTFB: ${TTFB}ms"
else
    echo "❌ Response missing timing metadata"
fi

if echo "$RESPONSE" | jq -e '.isRealAI' >/dev/null 2>&1; then
    echo "✅ Response has 'isRealAI' field"
    IS_REAL_AI=$(echo "$RESPONSE" | jq -r '.isRealAI')
    echo "   Is Real AI: $IS_REAL_AI"
else
    echo "❌ Response missing 'isRealAI' field"
fi

# 6) Test second request (should use cached broker)
echo ""
echo "6. Testing second request (should use cached broker):"
RESPONSE2=$(curl -s -X POST http://localhost:3000/api/compute/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Second test message","agentMetadata":{"name":"TestAgent2","description":"Another test agent"}}')

echo "Second response timing:"
echo "$RESPONSE2" | jq '.metadata.timing' 2>/dev/null || echo "No timing data"

# 7) Clean up
echo ""
echo "7. Cleaning up..."
kill $DEV_PID 2>/dev/null
echo "✅ Test completed!"

echo ""
echo "=== Expected behavior checklist ==="
echo "□ First request logs 'Initializing new broker...'"
echo "□ Subsequent requests log 'Using cached broker'"
echo "□ Provider acknowledge happens once, then shows 'Provider already acknowledged (cached)'"
echo "□ Response time < 2-4 seconds (if live provider available)"
echo "□ Response JSON contains metadata.timing.totalTTFB"
echo "□ No 'invalid BigNumberish value' errors in logs"
echo "□ pnpm build and pnpm type-check pass ✅"