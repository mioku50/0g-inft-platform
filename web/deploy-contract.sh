#!/bin/bash

# Test deployment of AgentModelRegistry contract
# This script will deploy the contract to Galileo Testnet v3

echo "🚀 Deploying AgentModelRegistry contract..."

# Check environment variables
if [ -z "$OG_COMPUTE_PRIVATE_KEY" ]; then
    echo "❌ OG_COMPUTE_PRIVATE_KEY environment variable is required"
    exit 1
fi

# Navigate to contracts directory
cd contracts

echo "📦 Installing ethers if needed..."
npm list ethers > /dev/null 2>&1 || npm install ethers

echo "🔧 Deploying contract..."
node deploy-agent-model-registry.js

echo "✅ Deployment complete!"
echo "📝 Please update NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS in .env with the deployed address"