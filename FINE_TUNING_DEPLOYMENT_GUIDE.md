# Fine-tuning System Deployment Guide

## 🚀 Complete Setup Guide

This guide provides step-by-step instructions for deploying and configuring the stabilized fine-tuning system.

## ✅ Prerequisites

1. **Node.js 18+** and npm/pnpm
2. **0G Testnet Tokens** - Get from [0G Faucet](https://faucet.0g.ai)
3. **Environment Access** - Galileo Testnet v3 connectivity

## 📦 Installation

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/mioku50/0g-inft-platform.git
cd 0g-inft-platform/web
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Update `.env.local` with your configuration:

```env
# Required Variables (Update these!)
OG_COMPUTE_PRIVATE_KEY=your_platform_private_key_here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Network Configuration (Pre-configured for Galileo Testnet v3)
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_0G_CHAIN_ID=16601

# Contract Addresses (Pre-configured)
NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS=0x358d481AbFE7548EA8F3a806c675729910F29E4e
NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa
```

### 3. Test Configuration

```bash
../test-fine-tuning-config.sh
```

This validates:
- ✅ Environment variables
- ✅ RPC connectivity  
- ✅ TypeScript compilation
- ✅ Contract configuration

## 🏗️ Contract Deployment (Optional)

If you need to deploy your own registry contract:

```bash
# Set your platform private key
export OG_COMPUTE_PRIVATE_KEY="your_private_key_here"

# Deploy the contract
./deploy-contract.sh

# Update .env.local with the new address
# NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS=0x...newly_deployed_address
```

## 🚀 Start the Application

```bash
npm run dev
```

The application will be available at http://localhost:3000

## 🧪 Testing the Fine-tuning System

### 1. Access Fine-tuning Interface

1. Navigate to any agent page
2. Click the "Fine-tune" tab
3. Complete the 6-step workflow:

   - **Step 1: Account** - Create/fund compute account
   - **Step 2: Dataset** - Upload training data (.jsonl/.json/.txt)
   - **Step 3: Model** - Select from 6 available AI models
   - **Step 4: Parameters** - Configure training settings
   - **Step 5: Training** - Start fine-tuning with on-chain attestation
   - **Step 6: Monitor** - Track progress and activate models

### 2. Verify System Stability

The system now includes comprehensive fixes for:

- ✅ **TSX Compilation** - No more JSX/TypeScript errors
- ✅ **Registry Reads** - Safe getters with graceful error handling
- ✅ **RPC Rate Limiting** - Provider singleton with throttling and backoff
- ✅ **API Error Handling** - Detailed HTTP 500 error logging and validation
- ✅ **Environment Configuration** - Proper contract addresses and ABI alignment

## 🔧 System Architecture

### Rate-Limited Provider
- **Max Concurrent**: 4 RPC requests
- **Backoff Strategy**: 50ms → 2000ms exponential with jitter
- **Cache TTL**: 5 seconds for request deduplication
- **Error Handling**: Automatic retry on -32005 rate limit errors

### Safe Contract Calls
- **Registry Methods**: getActiveModel/getCandidateModel with fallbacks
- **Error Recovery**: Graceful handling of missing models
- **Validation**: Optional owner() checks for contract verification

### Enhanced API Logging
- **Step-by-step tracking**: 0G SDK → On-chain attestation → Database
- **Error Context**: Detailed operation context for troubleshooting
- **Input Validation**: Comprehensive parameter validation with helpful messages

## 🔍 Troubleshooting

### Common Issues

#### "Rate limit exceeded -32005"
✅ **Fixed**: Rate-limited provider with automatic retry

#### "CALL_EXCEPTION getActiveModel"  
✅ **Fixed**: Safe contract calls with fallback values

#### "Start Fine-tune HTTP 500"
✅ **Fixed**: Enhanced error logging shows exact failure point

#### "TSX compilation errors"
✅ **Fixed**: Proper JSX syntax and TypeScript types

### Debug Commands

```bash
# Check environment configuration
../test-fine-tuning-config.sh

# Check TypeScript compilation
npm run type-check

# Check RPC connectivity
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://evmrpc-testnet.0g.ai

# Test contract validation
node -e "
const { AgentModelRegistryService } = require('./lib/contracts/agent-model-registry');
AgentModelRegistryService.validateContract().then(console.log);
"
```

### Log Analysis

The system provides detailed logging for troubleshooting:

```bash
# API Logs (Start Fine-tune)
tail -f ~/.pm2/logs/app-out.log | grep "fine-tune"

# RPC Rate Limiting Logs  
tail -f ~/.pm2/logs/app-out.log | grep "Rate limit"

# Contract Interaction Logs
tail -f ~/.pm2/logs/app-out.log | grep "AgentModelRegistry"
```

## 📊 Monitoring

### Key Metrics to Monitor

1. **RPC Rate Limits**: Should see <1% -32005 errors
2. **Registry Calls**: getActiveModel/getCandidateModel success rate >99%
3. **API Response Times**: /api/compute/fine-tune <10s typical
4. **Contract Gas Usage**: Attestation transactions <500k gas

### Health Checks

```bash
# Test all systems
curl http://localhost:3000/api/compute/fine-tune-account
curl http://localhost:3000/api/storage/health
```

## 🎯 Success Criteria

✅ **All 5 zones stabilized**:
1. Registry reads work without reverts
2. No RPC rate limit errors during normal operation  
3. Start Fine-tune API returns proper errors instead of HTTP 500
4. TypeScript compilation successful
5. Contract addresses properly configured

✅ **User Experience**:
- Fine-tuning workflow completes end-to-end
- Model activation works with "Make Active" button
- Real-time progress monitoring functional
- Error messages helpful and actionable

## 🔗 Additional Resources

- [0G Compute Documentation](https://docs.0g.ai/build-with-0g/compute-network)
- [Galileo Testnet Explorer](https://chainscan-galileo.0g.ai)
- [0G Discord Support](https://discord.gg/0glabs)

---

**Ready for Production** 🚀

The fine-tuning system is now fully stabilized and ready for production deployment with all major issues resolved.