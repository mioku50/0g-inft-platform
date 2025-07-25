# Development Notes

This project uses the official 0G FineTuningServing contract deployed on the testnet.

## Environment Variables

**Server-only (required):**
- `OG_COMPUTE_PRIVATE_KEY` – private key of the wallet used for transactions (server-only)

**Public (can be used client-side):**
- `NEXT_PUBLIC_0G_RPC_URL` – RPC endpoint for 0G testnet
- `NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS` – address of the FineTuningServing contract (`0xda478Ccf5d534346A16b1475E4c2DecE0268B176`)
- `NEXT_PUBLIC_FINE_TUNE_PROVIDER` – official fine tuning provider address (`0xf07240Efa67755B5311bc75784a061eDB47165Dd`)

## Basic Workflow

1. Start dev server:
   ```bash
   pnpm --filter ./web dev
   ```

2. Create or deposit to your fine‑tuning account:
   ```bash
   curl -X POST http://localhost:3000/api/compute/account \
        -H 'content-type: application/json' \
        -d '{"amount":"0.01","action":"create"}'
   ```

3. Check account status:
   ```bash
   curl http://localhost:3000/api/compute/account | jq
   ```

## Comprehensive Smoke Tests

### 0. Environment Validation
```bash
# Check if all required environment variables are set
node -e "
const env = process.env;
const required = ['NEXT_PUBLIC_0G_RPC_URL', 'NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS', 'NEXT_PUBLIC_FINE_TUNE_PROVIDER', 'OG_COMPUTE_PRIVATE_KEY'];
const missing = required.filter(key => !env[key]);
if (missing.length > 0) {
  console.log('❌ Missing environment variables:', missing.join(', '));
  process.exit(1);
} else {
  console.log('✅ All environment variables are set');
}
"
```

### 1. Contract Deployment Check
```bash
# Verify that the FineTuningServing contract is deployed
node -e "
import { JsonRpcProvider } from 'ethers';
(async () => {
  try {
    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL);
    const code = await provider.getCode(process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
    if (code && code !== '0x') {
      console.log('✅ FineTuningServing contract is deployed');
      console.log('Contract address:', process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
      console.log('Code size:', code.length, 'bytes');
    } else {
      console.log('❌ FineTuningServing contract NOT DEPLOYED at', process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking contract deployment:', error.message);
    process.exit(1);
  }
})();
"
```

### 2. API Health Check
```bash
# Test if the server is running and APIs are accessible
echo "🔍 Testing API health..."

# Test account API
echo "Testing /api/compute/account..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/compute/account | \
  grep -q "200\|503" && echo "✅ Account API responding" || echo "❌ Account API not responding"
```

### 3. Account Management Tests
```bash
# Create account with initial deposit
echo "🏦 Testing account creation..."
ACCOUNT_RESULT=$(curl -s -X POST http://localhost:3000/api/compute/account \
  -H 'content-type: application/json' \
  -d '{"amount":"0.01","action":"create"}')

echo "Account creation result:"
echo "$ACCOUNT_RESULT" | jq '.'

# Check account balance
echo "💰 Checking account balance..."
BALANCE_RESULT=$(curl -s http://localhost:3000/api/compute/account)
echo "Account status:"
echo "$BALANCE_RESULT" | jq '.'

# Verify balance is sufficient
BALANCE=$(echo "$BALANCE_RESULT" | jq -r '.balance // "0"')
if (( $(echo "$BALANCE >= 0.001" | bc -l) )); then
  echo "✅ Account has sufficient balance: $BALANCE OG"
else
  echo "⚠️  Account balance may be insufficient: $BALANCE OG"
fi
```

### 4. Fine-tuning Task Tests
```bash
# Create a fine-tuning task
echo "🧠 Testing fine-tuning task creation..."
TASK_RESULT=$(curl -s -X POST http://localhost:3000/api/compute/fine-tune \
  -H 'content-type: application/json' \
  -d '{
    "agentId": "test-agent-1",
    "datasetRootHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "baseModel": "llama-3.3-70b",
    "steps": 100,
    "learningRate": 0.00005
  }')

echo "Task creation result:"
echo "$TASK_RESULT" | jq '.'

# Extract task ID for status checking
TASK_ID=$(echo "$TASK_RESULT" | jq -r '.taskId // empty')

if [ -n "$TASK_ID" ]; then
  echo "✅ Task created successfully with ID: $TASK_ID"
  
  # Check task status
  echo "📊 Checking task status..."
  STATUS_RESULT=$(curl -s "http://localhost:3000/api/compute/fine-tune?taskId=$TASK_ID")
  echo "Task status:"
  echo "$STATUS_RESULT" | jq '.'
  
  PROGRESS=$(echo "$STATUS_RESULT" | jq -r '.progress // "Unknown"')
  echo "Current progress: $PROGRESS"
  
else
  echo "❌ Failed to create task or extract task ID"
fi
```

### 5. Provider Connectivity Test
```bash
# Test provider endpoint connectivity (if accessible)
echo "🌐 Testing provider connectivity..."
PROVIDER_URL="https://fine-tune-provider.example.com" # Replace with actual provider URL if known

# This is a placeholder - actual provider URL would need to be configured
echo "Provider endpoint: $PROVIDER_URL"
echo "ℹ️  Provider connectivity test requires actual provider URL configuration"
```

### 6. Refund Test
```bash
# Test refund functionality
echo "💸 Testing refund request..."
REFUND_RESULT=$(curl -s -X DELETE http://localhost:3000/api/compute/account)
echo "Refund request result:"
echo "$REFUND_RESULT" | jq '.'

if echo "$REFUND_RESULT" | jq -e '.success' > /dev/null; then
  echo "✅ Refund request submitted successfully"
else
  echo "⚠️  Refund request may have failed or account has no balance to refund"
fi
```

### 7. Type Check and Build Test
```bash
# Verify TypeScript compilation
echo "🔍 Running TypeScript type check..."
cd web && pnpm type-check
if [ $? -eq 0 ]; then
  echo "✅ TypeScript type check passed"
else
  echo "❌ TypeScript type check failed"
  exit 1
fi

# Test build process
echo "🏗️  Testing build process..."
cd web && pnpm build
if [ $? -eq 0 ]; then
  echo "✅ Build completed successfully"
else
  echo "❌ Build failed"
  exit 1
fi
```

## Integration Test Script

Create and run a complete test suite:

```bash
#!/bin/bash
# save as test-fine-tune-flow.sh and run with: chmod +x test-fine-tune-flow.sh && ./test-fine-tune-flow.sh

set -e  # Exit on any error

echo "🚀 Starting Fine-tune Flow Integration Tests"
echo "=============================================="

# Test 1: Environment check
echo "1️⃣  Environment validation..."
node -e "
const env = process.env;
const required = ['NEXT_PUBLIC_0G_RPC_URL', 'NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS', 'NEXT_PUBLIC_FINE_TUNE_PROVIDER', 'OG_COMPUTE_PRIVATE_KEY'];
const missing = required.filter(key => !env[key]);
if (missing.length > 0) {
  console.log('❌ Missing:', missing.join(', '));
  process.exit(1);
}
console.log('✅ Environment OK');
"

# Test 2: Contract deployment
echo "2️⃣  Contract deployment check..."
node -e "
import { JsonRpcProvider } from 'ethers';
(async () => {
  const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL);
  const code = await provider.getCode(process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS);
  if (!code || code === '0x') {
    console.log('❌ Contract not deployed');
    process.exit(1);
  }
  console.log('✅ Contract deployed');
})();
"

# Test 3: Account creation
echo "3️⃣  Account creation..."
curl -s -X POST http://localhost:3000/api/compute/account \
  -H 'content-type: application/json' \
  -d '{"amount":"0.01","action":"create"}' | \
  jq -e '.success' > /dev/null && echo "✅ Account created" || echo "⚠️  Account creation result unclear"

# Test 4: Balance check
echo "4️⃣  Balance verification..."
BALANCE=$(curl -s http://localhost:3000/api/compute/account | jq -r '.balance // "0"')
echo "Balance: $BALANCE OG"

# Test 5: Task creation (mock)
echo "5️⃣  Task creation test..."
curl -s -X POST http://localhost:3000/api/compute/fine-tune \
  -H 'content-type: application/json' \
  -d '{"agentId":"test","datasetRootHash":"0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef","baseModel":"llama-3.3-70b","steps":100,"learningRate":0.00005}' | \
  jq -e '.taskId' > /dev/null && echo "✅ Task creation API working" || echo "⚠️  Task creation may require valid dataset"

echo "🎉 Integration tests completed!"
```

## Troubleshooting

### Common Issues

1. **"Compute misconfigured" error**
   - Check that all environment variables are set correctly
   - Verify the private key format (should start with 0x and be 64 characters)
   - Ensure the RPC URL is accessible

2. **"Contract not deployed" error**
   - Verify the contract address is correct
   - Check that you're connecting to the right network

3. **"Insufficient balance" error**
   - Create an account with sufficient deposit (minimum 0.001 OG)
   - Check account balance with the balance API

4. **Provider connectivity issues**
   - Verify the provider address is correct
   - Check network connectivity
   - Ensure the provider service is running

### Debug Commands

```bash
# Check environment variables
printenv | grep -E "(0G|FINE_TUNE|OG_COMPUTE)"

# Test RPC connectivity
curl -X POST $NEXT_PUBLIC_0G_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check server logs
tail -f .next/server.log  # or wherever your logs are stored
```
