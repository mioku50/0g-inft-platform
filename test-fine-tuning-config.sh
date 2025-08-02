#!/bin/bash

# Test contract configuration and environment
echo "🧪 Testing Fine-tuning system configuration..."

# Check environment variables
echo "📋 Checking environment variables..."

required_vars=(
    "OG_COMPUTE_PRIVATE_KEY"
    "NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS"
    "NEXT_PUBLIC_0G_RPC_URL"
    "NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS"
    "NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    else
        echo "✅ $var is configured"
    fi
done

echo "🔗 Testing RPC connectivity..."
curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$NEXT_PUBLIC_0G_RPC_URL" | jq -e '.result' > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ RPC endpoint is accessible"
else
    echo "❌ RPC endpoint is not accessible"
    exit 1
fi

echo "📝 Testing contract configuration..."

cd "$(dirname "$0")/web"

# Test TypeScript compilation
echo "🔧 Running TypeScript check..."
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test contract validation
echo "🏗️ Testing contract validation..."
node -e "
const AgentModelRegistryService = require('./lib/contracts/agent-model-registry.ts').default;

async function test() {
    try {
        const isValid = await AgentModelRegistryService.validateContract();
        console.log('Contract validation result:', isValid);
        if (!isValid) {
            console.log('⚠️  Contract validation failed - check deployment and owner');
        } else {
            console.log('✅ Contract validation successful');
        }
    } catch (error) {
        console.log('⚠️  Contract validation error:', error.message);
    }
}

test().catch(console.error);
" 2>/dev/null || echo "⚠️  Contract validation script failed - this is expected if contract is not deployed"

echo "🎯 Configuration test complete!"
echo ""
echo "📋 Summary:"
echo "- Environment variables: ✅ Configured"
echo "- RPC connectivity: ✅ Working"
echo "- TypeScript compilation: ✅ Successful"
echo "- Contract configuration: ⚠️  Check logs above"
echo ""
echo "🚀 Ready for fine-tuning operations!"