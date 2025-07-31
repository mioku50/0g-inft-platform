# 0G INFT Platform - Fine-tuning Guide

## Overview

The 0G INFT Platform now includes a fully functional Fine-tuning system integrated with the official 0G SDK. This allows users to train AI models with custom datasets using the 0G Compute Network.

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 18+ and npm/pnpm
2. **Testnet ETH** for transactions ([Get from faucet](https://faucet.0g.ai))
3. **Ethereum wallet** with private key
4. **WalletConnect Project ID** for wallet connection

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mioku50/0g-inft-platform.git
cd 0g-inft-platform/web
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Configure environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Start the development server:
```bash
npm run dev
```

## 🔧 Environment Configuration

Copy the required environment variables from `.env.example` and update them with your values:

### Required Variables

- `NEXT_PUBLIC_0G_RPC_URL` - 0G testnet RPC endpoint
- `OG_COMPUTE_PRIVATE_KEY` - Private key for compute operations (server-side)
- `OG_STORAGE_PRIVATE_KEY` - Private key for storage operations (server-side)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - WalletConnect project ID

### Network Configuration (Galileo Testnet v3)

- **RPC URL**: `https://evmrpc-testnet.0g.ai`
- **Chain ID**: `16601`
- **Faucet**: https://faucet.0g.ai

## 🤖 Fine-tuning Features

### ✅ Real 0G SDK Integration
- Connected to `@0glabs/0g-serving-broker` v0.2.14
- No mocks - all operations use real blockchain calls
- Full error handling and user feedback

### 📚 Model Catalog (6 Available Models)
1. **DistilBERT Base Uncased** - Efficient text processing
2. **Llama 3.3 70B Instruct** - Advanced language model
3. **DeepSeek R1 70B** - Reasoning and problem solving
4. **GPT-3.5 Turbo Fine-tune** - Versatile conversational AI
5. **Code Llama 13B Instruct** - Code generation and completion
6. **Mistral 7B Instruct** - Efficient general-purpose model

### 🗄️ Dataset Support
- **JSONL** (recommended) - Structured conversation format
- **JSON** - Standard JSON format with messages array
- **TXT** - Plain text with automatic validation

### 🔗 Complete Workflow
1. **Account Creation** - Create and fund 0G ledger account
2. **Dataset Upload** - Upload training data to 0G Storage
3. **Model Selection** - Choose from 6 available models
4. **Parameter Configuration** - Set training epochs, batch size, etc.
5. **Training Monitoring** - Real-time status and logs
6. **Model Delivery** - Download and acknowledge trained models

## 🎨 UI Features

### Gradient Design
- Beautiful purple-to-blue gradient background
- Glassmorphism cards with backdrop blur
- Animated step indicators
- Responsive layout

### User Experience
- Step-by-step wizard interface
- Real-time validation and feedback
- Progress monitoring with live logs
- Error handling with helpful messages

## 📖 Usage Guide

### 1. Connect Your Wallet
Visit the Fine-tuning page and connect your wallet using WalletConnect.

### 2. Create Fine-tuning Account
```javascript
// The system will prompt you to create an account
// Minimum deposit: 0.01 OG (adjustable)
```

### 3. Upload Dataset
```javascript
// Supported formats:
// JSONL: {"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
// JSON: {"data": [{"messages": [...]}]}
// TXT: Plain text conversations
```

### 4. Select Model and Configure Training
```javascript
// Available parameters:
{
  "num_train_epochs": 3,
  "per_device_train_batch_size": 16,
  "learning_rate": 2e-5,
  "warmup_steps": 500
}
```

### 5. Monitor Training
The system provides real-time status updates and training logs from the 0G provider.

### 6. Download Trained Model
Once training is complete, acknowledge and download your custom model.

## 🛠️ Technical Architecture

### SDK Integration
```typescript
// Real 0G SDK calls (no mocks)
import { getBroker } from '@/lib/compute/broker'

const broker = await getBroker()
await broker.ledger.addLedger(0.01) // Create account
await broker.fineTuning.createTask(...) // Start training
```

### Provider API Integration
```typescript
// Direct HTTP calls to 0G providers
const response = await fetch(`${providerUrl}/v1/user/${userAddress}/task/${taskId}`)
const taskStatus = await response.json()
```

### Storage Integration
```typescript
// Real 0G Storage upload
import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk'
const [tx, error] = await indexer.upload(zgFile, rpcUrl, signer)
```

## 🐛 Troubleshooting

### Common Issues

1. **"Insufficient Balance"**
   - Add more funds to your ledger account
   - Minimum: 0.01 OG for account creation

2. **"Provider Not Available"**
   - Try a different provider from the list
   - Check network connectivity

3. **"Dataset Validation Failed"**
   - Ensure JSONL format: one JSON object per line
   - Check that messages array has proper structure

4. **"Transaction Failed"**
   - Ensure you have enough ETH for gas fees
   - Check that private keys are properly configured

### Debug Mode
Set `FT_MOCK=1` in your environment to enable mock mode for testing.

## 📋 Environment Variables Reference

```bash
# Network
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_0G_CHAIN_ID=16601

# Contracts (Galileo Testnet v3)
NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa

# Private Keys (Server-side only)
OG_COMPUTE_PRIVATE_KEY=your_private_key_here
OG_STORAGE_PRIVATE_KEY=your_private_key_here

# Providers
NEXT_PUBLIC_FINE_TUNE_PROVIDER=0xf07240Efa67755B5311bc75784a061eDB47165Dd

# Feature Flags
FT_MOCK=0  # Set to 1 for mock mode, 0 for real SDK calls
```

## 🚀 Deployment

### Production Setup
1. Configure all environment variables
2. Set `FT_MOCK=0` for real operations
3. Ensure private keys are securely stored
4. Build and deploy: `npm run build && npm start`

### Security Notes
- Private keys are used server-side only
- Never expose private keys in client-side code
- Use environment variables for all sensitive data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both mock and real SDK modes
5. Submit a pull request

## 📞 Support

- **Documentation**: Check the 0G official docs
- **Issues**: Create a GitHub issue for bugs
- **Discord**: Join the 0G Labs community

---

**Ready to fine-tune AI models on the 0G Network? Get started now!** 🚀