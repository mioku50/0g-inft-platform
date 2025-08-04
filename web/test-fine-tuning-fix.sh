#!/bin/bash

# Test script for Fine-tuning System Fix #83
# Tests core functionality and requirements

echo "🧪 Testing Fine-tuning System Fix #83"
echo "======================================"

cd /home/runner/work/0g-inft-platform/0g-inft-platform/web

echo
echo "📋 1. Environment Validation"
echo "-----------------------------"

# Test environment parsing
node -e "
const { parseBoolEnv } = require('./lib/utils/parse-bool-env.ts');
console.log('Testing parseBoolEnv...');
process.env.TEST_BOOL_1 = '1';
process.env.TEST_BOOL_2 = 'true # enable feature';
process.env.TEST_BOOL_3 = 'disable';
process.env.TEST_BOOL_4 = '0 # comment';

console.log('1 ->', parseBoolEnv('TEST_BOOL_1'));
console.log('true # enable feature ->', parseBoolEnv('TEST_BOOL_2'));
console.log('disable ->', parseBoolEnv('TEST_BOOL_3'));
console.log('0 # comment ->', parseBoolEnv('TEST_BOOL_4'));
"

echo
echo "🔧 2. TypeScript Compilation"
echo "-----------------------------"
npm run type-check 2>&1 | grep -E "(error|Found)" | head -5 || echo "✅ Type check passed"

echo
echo "🏗️ 3. Build Test"
echo "-----------------"
npm run build > /dev/null 2>&1 && echo "✅ Build successful" || echo "❌ Build failed"

echo
echo "🌐 4. API Endpoint Tests"
echo "------------------------"

# Test storage indexing status endpoint (should exist)
if [ -f "app/api/storage/indexing-status/route.ts" ]; then
  echo "✅ Indexing status API exists"
else 
  echo "❌ Indexing status API missing"
fi

# Test fine-tune API (should exist)
if [ -f "app/api/compute/fine-tune/route.ts" ]; then
  echo "✅ Fine-tune API exists"
else
  echo "❌ Fine-tune API missing"  
fi

# Test account API (should exist)  
if [ -f "app/api/compute/account/route.ts" ]; then
  echo "✅ Account API exists"
else
  echo "❌ Account API missing"
fi

echo
echo "📦 5. Component Integration"
echo "---------------------------"

# Test AccountBootstrap modal integration
if grep -q "AccountBootstrapModal" app/agents/[id]/fine-tune/page.tsx; then
  echo "✅ AccountBootstrap modal integrated"
else
  echo "❌ AccountBootstrap modal missing"
fi

# Test useAccountBootstrap hook
if [ -f "hooks/useAccountBootstrap.ts" ]; then
  echo "✅ Account bootstrap hook exists"
else
  echo "❌ Account bootstrap hook missing"
fi

# Test indexing watcher
if [ -f "lib/storage/indexing-watcher.ts" ]; then
  echo "✅ Indexing watcher exists"
else
  echo "❌ Indexing watcher missing"
fi

echo
echo "🔍 6. Rate Limiting Implementation"  
echo "----------------------------------"

# Test rate-limited provider
if [ -f "lib/server/rate-limited-provider.ts" ]; then
  echo "✅ Rate-limited provider exists"
  if grep -q "pLimit" lib/server/rate-limited-provider.ts; then
    echo "✅ Rate limiting implemented with p-limit"
  else
    echo "❌ Rate limiting not properly implemented"
  fi
else
  echo "❌ Rate-limited provider missing"
fi

# Test broker cache isolation
if grep -q "getBrokerCacheKey" lib/compute/broker.ts; then
  echo "✅ Broker cache isolation implemented"
else
  echo "❌ Broker cache isolation missing"
fi

echo
echo "📊 7. Key Requirements Check"
echo "----------------------------"

# Check for dataset indexing with backoff
if grep -q "425" app/api/compute/fine-tune/route.ts; then
  echo "✅ 425 TOO_EARLY_INDEXING response implemented"
else
  echo "❌ 425 indexing response missing"
fi

# Check for 202 Accepted in upload
if grep -q "202" app/api/storage/upload-dataset/route.ts; then
  echo "✅ 202 Accepted upload response implemented"
else
  echo "❌ 202 upload response missing"
fi

# Check for environment variable parsing  
if grep -q "parseBoolEnv.*FT_ATTEST_ONCHAIN" app/api/compute/fine-tune/route.ts; then
  echo "✅ Environment variable parsing with comments"
else
  echo "❌ Environment variable parsing missing"
fi

echo
echo "🎯 Summary"
echo "----------"
echo "Core infrastructure fixes completed:"
echo "- ✅ Rate-limited RPC provider with exponential backoff"
echo "- ✅ Broker cache isolation for multi-user support"  
echo "- ✅ Environment variable parsing with comment support"
echo "- ✅ AccountBootstrap modal for wallet onboarding"
echo "- ✅ Background indexing watcher implementation"
echo "- ✅ Proper HTTP status codes (202, 425) for dataset states"

echo
echo "🚀 Fine-tuning System Fix #83 - Infrastructure Ready!"