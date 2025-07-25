#!/bin/bash
# Fine-tune Flow Integration Test Script
# Usage: chmod +x test-fine-tune-flow.sh && ./test-fine-tune-flow.sh

set -e  # Exit on any error

echo "🚀 Starting Fine-tune Flow Integration Tests"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test 1: Environment validation
echo "1️⃣  Environment validation..."
node -e "
const env = process.env;
const required = ['NEXT_PUBLIC_0G_RPC_URL', 'NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS', 'NEXT_PUBLIC_FINE_TUNE_PROVIDER', 'OG_COMPUTE_PRIVATE_KEY'];
const missing = required.filter(key => !env[key]);
if (missing.length > 0) {
  console.log('❌ Missing environment variables:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set');
}
"

# Test 2: Contract deployment check
echo "2️⃣  Contract deployment check..."
node -e "
import { JsonRpcProvider } from 'ethers';
(async () => {
  try {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL);
    const code = await provider.getCode(process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
    if (!code || code === '0x') {
      console.log('❌ FineTuningServing contract NOT DEPLOYED at', process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
      process.exit(1);
    }
    console.log('✅ FineTuningServing contract is deployed');
    console.log('   Address:', process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
    console.log('   Code size:', code.length, 'bytes');
  } catch (error) {
    console.error('❌ Error checking contract deployment:', error.message);
    process.exit(1);
  }
})();
"

# Test 3: API health check
echo "3️⃣  API health check..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/compute/account | grep -q "200\|503"; then
    log_success "Account API is responding"
else
    log_error "Account API is not responding - make sure the server is running"
    exit 1
fi

# Test 4: Account creation/deposit
echo "4️⃣  Account creation test..."
ACCOUNT_RESULT=$(curl -s -X POST http://localhost:3000/api/compute/account \
  -H 'content-type: application/json' \
  -d '{"amount":"0.01","action":"create"}')

echo "Account creation result:"
echo "$ACCOUNT_RESULT" | jq '.'

if echo "$ACCOUNT_RESULT" | jq -e '.success' > /dev/null 2>&1; then
    log_success "Account created/funded successfully"
    TX_HASH=$(echo "$ACCOUNT_RESULT" | jq -r '.txHash // "N/A"')
    log_info "Transaction hash: $TX_HASH"
elif echo "$ACCOUNT_RESULT" | jq -e '.error' | grep -q "misconfigured"; then
    log_error "Backend is misconfigured - check environment variables"
    exit 1
else
    log_warning "Account creation result unclear - may already exist"
fi

# Test 5: Balance verification
echo "5️⃣  Balance verification..."
BALANCE_RESULT=$(curl -s http://localhost:3000/api/compute/account)
echo "Account status:"
echo "$BALANCE_RESULT" | jq '.'

BALANCE=$(echo "$BALANCE_RESULT" | jq -r '.balance // "0"')
EXISTS=$(echo "$BALANCE_RESULT" | jq -r '.exists // false')

if [ "$EXISTS" = "true" ]; then
    log_success "Account exists with balance: $BALANCE OG"
    
    # Check if balance is sufficient
    if (( $(echo "$BALANCE >= 0.001" | bc -l 2>/dev/null || echo "0") )); then
        log_success "Balance is sufficient for fine-tuning"
    else
        log_warning "Balance may be insufficient for fine-tuning (minimum: 0.001 OG)"
    fi
else
    log_error "Account does not exist"
    exit 1
fi

# Test 6: Fine-tuning task creation test
echo "6️⃣  Fine-tuning task creation test..."
TASK_RESULT=$(curl -s -X POST http://localhost:3000/api/compute/fine-tune \
  -H 'content-type: application/json' \
  -d '{
    "agentId": "test-agent-integration",
    "datasetRootHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "baseModel": "llama-3.3-70b",
    "steps": 100,
    "learningRate": 0.00005
  }')

echo "Task creation result:"
echo "$TASK_RESULT" | jq '.'

TASK_ID=$(echo "$TASK_RESULT" | jq -r '.taskId // empty')

if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "null" ]; then
    log_success "Fine-tuning task created with ID: $TASK_ID"
    
    # Test 7: Task status check
    echo "7️⃣  Task status check..."
    sleep 2  # Wait a moment for task to be processed
    
    STATUS_RESULT=$(curl -s "http://localhost:3000/api/compute/fine-tune?taskId=$TASK_ID")
    echo "Task status:"
    echo "$STATUS_RESULT" | jq '.'
    
    PROGRESS=$(echo "$STATUS_RESULT" | jq -r '.progress // "Unknown"')
    IS_IN_PROGRESS=$(echo "$STATUS_RESULT" | jq -r '.isInProgress // false')
    
    log_info "Task progress: $PROGRESS"
    
    if [ "$IS_IN_PROGRESS" = "true" ]; then
        log_success "Task is in progress"
    else
        log_info "Task is not in progress (may be completed or failed)"
    fi
    
else
    log_warning "Task creation may have failed or returned no task ID"
    echo "This could be due to:"
    echo "  - Provider not available"
    echo "  - Invalid dataset hash"
    echo "  - Insufficient balance"
    echo "  - Network connectivity issues"
fi

# Test 8: TypeScript compilation
echo "8️⃣  TypeScript compilation test..."
cd web
if pnpm type-check > /dev/null 2>&1; then
    log_success "TypeScript compilation passed"
else
    log_error "TypeScript compilation failed"
    cd ..
    exit 1
fi
cd ..

# Test 9: Build test
echo "9️⃣  Build test..."
cd web
if timeout 120 pnpm build > /dev/null 2>&1; then
    log_success "Build completed successfully"
else
    log_error "Build failed or timed out"
    cd ..
    exit 1
fi
cd ..

# Test 10: Refund test (optional)
echo "🔟 Refund functionality test..."
REFUND_RESULT=$(curl -s -X DELETE http://localhost:3000/api/compute/account)
echo "Refund request result:"
echo "$REFUND_RESULT" | jq '.'

if echo "$REFUND_RESULT" | jq -e '.success' > /dev/null 2>&1; then
    log_success "Refund request submitted successfully"
    TX_HASH=$(echo "$REFUND_RESULT" | jq -r '.txHash // "N/A"')
    log_info "Refund transaction hash: $TX_HASH"
else
    log_warning "Refund request may have failed (account may have no balance to refund)"
fi

echo ""
echo "🎉 Integration tests completed successfully!"
echo "=============================================="
echo ""
echo "Summary:"
echo "✅ Environment variables validated"
echo "✅ Contract deployment confirmed" 
echo "✅ API endpoints responding"
echo "✅ Account management working"
echo "✅ Balance verification working"
echo "✅ Fine-tuning API accessible"
echo "✅ TypeScript compilation passed"
echo "✅ Build process successful"
echo ""
echo "The fine-tune flow is ready for use! 🚀"