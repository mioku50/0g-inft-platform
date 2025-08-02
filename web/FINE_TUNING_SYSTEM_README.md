# 🤖 Complete Fine-tuning System Rebuild - 0G SDK Integration

A comprehensive gasless fine-tuning system with on-chain attestations and model versioning for AI agents.

## 🌟 Features

### ✨ **Gasless User Experience**
- Users never pay gas fees or sign on-chain transactions
- Platform handles all blockchain interactions automatically
- Seamless fine-tuning workflow from start to finish

### 🔗 **Full On-Chain Transparency**
- **TaskCreated**: Fine-tuning task initiation attested on-chain
- **ModelDelivered**: Trained model delivery verified on-chain  
- **ModelActivated**: Model activation recorded on-chain
- All events publicly verifiable on [Galileo Testnet v3](https://chainscan-galileo.0g.ai)

### 📊 **Model Versioning System**
- **Candidate Models**: Delivered models awaiting activation
- **Active Models**: Currently deployed model for each agent
- **Version History**: Complete audit trail of all model versions
- **Make Active**: One-click activation with on-chain confirmation

### 🔄 **Complete Workflow**
1. **Account Setup** → Platform-funded compute account
2. **Dataset Upload** → Secure 0G Storage integration  
3. **Model Selection** → 6 available AI models
4. **Parameter Config** → Customizable training parameters
5. **Training** → Real 0G Compute Network execution
6. **Delivery & Activation** → Seamless candidate → active workflow

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │◄──►│   API Routes     │◄──►│ 0G SDK/Network │
│                 │    │                  │    │                 │
│ • Step Wizard   │    │ • Task Creation  │    │ • Real Training │
│ • Make Active   │    │ • Attestations   │    │ • Model Storage │  
│ • Status Monitor│    │ • Monitoring     │    │ • Provider APIs │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │  Smart Contract  │
                      │                  │
                      │ AgentModelRegistry│
                      │ • TaskCreated    │
                      │ • ModelDelivered │
                      │ • ModelActivated │
                      └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- 0G Testnet ETH ([Get from faucet](https://faucet.0g.ai))
- WalletConnect Project ID

### Installation

1. **Environment Setup**
```bash
cd web
cp .env.example .env.local
# Edit .env.local with your configuration
```

2. **Deploy AgentModelRegistry Contract**
```bash
# Set your platform private key
export OG_COMPUTE_PRIVATE_KEY="your_private_key_here"

# Deploy the contract
./deploy-contract.sh

# Update .env.local with the deployed contract address
```

3. **Start Development Server**
```bash
npm install
npm run dev
```

4. **Access the Application**
- Open http://localhost:3000
- Go to any agent → Fine-tune tab
- Complete the 6-step workflow

## 📋 Configuration

### Required Environment Variables

```env
# Network Configuration
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc-testnet.0g.ai
NEXT_PUBLIC_0G_CHAIN_ID=16601

# Contract Addresses (Update after deployment)
NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS=0x...  # Deploy and update
NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS=0xda478Ccf5d534346A16b1475E4c2DecE0268B176
NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT=0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa

# Platform Keys (Server-side only)
OG_COMPUTE_PRIVATE_KEY=your_platform_private_key_here
OG_STORAGE_PRIVATE_KEY=your_storage_private_key_here

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## 🎯 Available AI Models

| Model | Parameters | Training Time | GPU Requirement | Best For |
|-------|------------|---------------|------------------|----------|
| **DistilBERT Base** | 66M | 15-30 min | Tesla V100 | Text classification, fast inference |
| **Llama 3.3 70B** | 70B | 45-90 min | Tesla A100 | Complex reasoning, conversations |
| **DeepSeek R1 70B** | 70B | 60-120 min | Tesla A100 | Step-by-step reasoning, math |
| **GPT-3.5 Turbo** | 175B | 30-60 min | Tesla V100 | General purpose, customer service |
| **Code Llama 13B** | 13B | 20-40 min | Tesla V100 | Code generation, programming |
| **Mistral 7B** | 7B | 15-30 min | Tesla T4 | Efficient general purpose |

## 🔧 API Reference

### Core Endpoints

#### Fine-tuning Task Management
```typescript
// Create new fine-tuning task (with on-chain attestation)
POST /api/compute/fine-tune
{
  agentId: number,
  userAddress: string,
  modelId: string,
  datasetHash: string,
  datasetSize: number,
  trainingParams?: object,
  providerAddress?: string
}

// Monitor task progress
GET /api/compute/fine-tune?taskId=xxx
```

#### Model Activation
```typescript  
// Activate candidate model (gasless for user)
POST /api/agents/{id}/activate
{
  modelRootHash: string,
  userAddress: string,
  consentSignature?: { signature: string, hash: string }
}

// Get agent model information
GET /api/agents/{id}/activate
```

### React Hooks

```typescript
import { useFineTuning } from '@/hooks/useFineTuning'

function MyComponent() {
  const {
    // Account management
    account, initializeAccount, deposit,
    
    // Task management  
    createTask, getTask, getTaskLogs,
    
    // Model activation
    activateModel, getAgentModelInfo,
    
    // Utilities
    loading, error
  } = useFineTuning()
  
  // Create fine-tuning task
  const handleCreateTask = async () => {
    const result = await createTask({
      agentId: '1',
      userAddress: '0x...',
      modelId: 'distilbert-base-uncased',
      datasetHash: '0x...',
      datasetSize: 1024
    })
    console.log(`Task created: ${result}`)
  }
  
  // Activate model
  const handleActivateModel = async () => {
    const result = await activateModel('1', '0x...model_hash...')
    console.log(`Model activated: ${result.txHashActivated}`)
  }
}
```

## 💾 Database Schema

The system uses an in-memory database for MVP with persistence to JSON files:

```typescript
// Model versions with status tracking
interface ModelVersion {
  id: number
  agentId: number
  modelRootHash: string
  status: 'candidate' | 'active' | 'archived'
  datasetRootHash: string
  pretrainedHash: string
  trainingParamsHash: string
  providerAddress: string
  taskId: string
  txHashCreated?: string
  txHashDelivered?: string
  txHashActivated?: string
  createdAt: Date
  deliveredAt?: Date
  activatedAt?: Date
}

// Training task lifecycle tracking  
interface TrainingTask {
  id: number
  taskId: string
  agentId: number
  userAddress: string
  providerAddress: string
  modelId: string
  status: string // 0G task status
  modelRootHash?: string
  txHashAttested?: string
  createdAt: Date
  deliveredAt?: Date
}
```

## 🔒 Security Features

### Platform-Controlled Operations
- All on-chain transactions signed by platform service key
- Users never expose private keys to the application
- Gasless experience while maintaining full transparency

### Optional Consent Signatures
```typescript
// EIP-712 off-chain signatures for consent tracking
const consent = {
  agentId: 1,
  modelRootHash: '0x...',
  timestamp: Date.now()
}

// Signature stored off-chain, hash included in on-chain event
const signature = await signer.signTypedData(domain, types, consent)
```

### On-Chain Verification
- Contract owner validation ensures only platform can attest
- Model delivery verification before activation
- Transparent audit trail for all model versions

## 🎨 UI Components

### Fine-tuning Wizard
6-step guided workflow with validation and progress tracking:

```typescript
const steps = [
  { id: 1, label: 'Account', icon: Wallet },
  { id: 2, label: 'Dataset', icon: Upload },  
  { id: 3, label: 'Model', icon: Brain },
  { id: 4, label: 'Parameters', icon: Settings },
  { id: 5, label: 'Training', icon: Play },
  { id: 6, label: 'Monitor', icon: Monitor }
]
```

### Model Status Badges
- 🟢 **Active**: Currently deployed model
- 🟠 **Candidate**: Delivered, awaiting activation  
- 🟣 **Training**: Fine-tuning in progress
- 🔵 **Archived**: Previous model versions

### Agent Card Enhancements
Agent cards display model status and activation options:
- Active model version with on-chain link
- Candidate model with "Make Active" button
- Training progress indicator
- Model version history

## 🧪 Testing

### Complete Workflow Test
```bash
# Test the full fine-tuning workflow
cd scripts
./test-fine-tuning-workflow.sh
```

### Manual Testing Steps
1. **Account Creation**: Create fine-tuning account with 0.01 OG deposit
2. **Dataset Upload**: Upload JSON/JSONL/TXT training data
3. **Model Selection**: Choose from 6 available models
4. **Training Start**: Begin fine-tuning with on-chain attestation  
5. **Monitor Progress**: Watch real-time status updates
6. **Model Activation**: Activate delivered candidate model
7. **Verification**: Confirm active model in agent card

## 📊 Monitoring & Logs

### Transaction Monitoring
All transactions are logged with chain links:
```typescript
// View on-chain attestations
https://chainscan-galileo.0g.ai/tx/{txHash}

// Event monitoring
TaskCreated(tokenId, user, provider, datasetRoot, taskId, timestamp)
ModelDelivered(tokenId, user, provider, modelRoot, taskId, timestamp) 
ModelActivated(tokenId, modelRoot, by, timestamp)
```

### Progress Tracking
- Real-time task status from 0G provider APIs
- Database persistence for offline status
- WebSocket events for live UI updates (future)

## 🚨 Troubleshooting

### Common Issues

#### "Contract address not configured"
```bash
# Deploy the AgentModelRegistry contract first
./deploy-contract.sh

# Update .env.local with the deployed address
NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS=0x...
```

#### "Insufficient balance for platform operations"
```bash
# Fund the platform wallet with 0G testnet tokens
# Get tokens from: https://faucet.0g.ai
```

#### "Task creation failed"
```bash
# Check platform private key configuration
echo $OG_COMPUTE_PRIVATE_KEY

# Verify 0G Compute Network connectivity
curl https://evmrpc-testnet.0g.ai
```

#### "Model activation failed"
```bash
# Ensure model is in 'candidate' status
# Check that model was properly delivered
# Verify contract permissions
```

## 🚀 Production Deployment

### Database Migration
For production, migrate from in-memory to PostgreSQL:
```typescript
// Update database/connection.ts to use PostgreSQL
const db = new PostgreSQLDatabase(process.env.DATABASE_URL)
```

### Environment Configuration
```bash
# Production environment setup
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://...
export LOG_LEVEL=warn
```

### Monitoring Setup
- Set up transaction monitoring alerts
- Configure error tracking (Sentry/Bugsnag)
- Enable performance monitoring
- Set up uptime monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the architecture patterns
4. Test the complete workflow
5. Submit a pull request

### Development Guidelines
- Follow the gasless architecture pattern
- Maintain on-chain transparency for key events
- Preserve the step-based UI workflow
- Add comprehensive error handling
- Include transaction monitoring

## 📚 Additional Resources

- [0G Compute Network Documentation](https://docs.0g.ai/build-with-0g/compute-network)
- [0G Storage Integration Guide](https://docs.0g.ai/build-with-0g/storage-network)  
- [Galileo Testnet v3 Information](https://docs.0g.ai/testnet)
- [EIP-712 Typed Data Signatures](https://eips.ethereum.org/EIPS/eip-712)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Ready to fine-tune AI models with gasless blockchain integration? Get started now!** 🚀