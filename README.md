1) @0glabs/0g-serving-user-broker (клиентский/серверный TS-SDK для dApp)

Появился «всё-в-одном» брокер:

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-user-broker'
// + createInferenceBroker / createLedgerBroker, но обычно достаточно ZGComputeNetworkBroker


Ключевые методы (типизация в d.ts):

broker.inference.listService() — список сервисов.

broker.inference.getServiceMetadata(provider) → { endpoint, model }.

broker.inference.getRequestHeaders(provider, content, vllmProxy?) — контент обязателен (раньше могли генерить без него).

broker.inference.acknowledgeProviderSigner(provider) — обязательный ACK перед запросами.

broker.inference.processResponse(provider, content, chatID?) — верификация ответа (TEE).

Структуры контрактов изменились: теперь у сервиса есть поле additionalInfo, verifiability — это строка, иные названия балансов в Ledger (см. ниже).

2) 0g-serving-broker (брокер/провайдер на Go — это «серверная» часть сети)

В биндингах видно новые структуры (Go): ServiceParams включает
serviceType, url, model, verifiability, inputPrice, outputPrice, additionalInfo.

Это значит: ABI твоего приложения обязана содержать эти поля. Если их нет — будут «missing revert data / decode» и прочие странности.

3) 0g-ts-sdk (storage)

Без критичных для Compute изменений. Это про хранение (ZgFile/Indexer). Можно оставить как есть.

Почему у тебя чат не работает сейчас

Несовпадение ABI InferenceServing
В твоём web/lib/contracts/abis.ts (или соседнем файле) структура сервиса, похоже, старая (без additionalInfo / с другим порядком полей).
Итог: listService() и getServiceMetadata() либо возвращают пусто, либо разваливаются на декодировании → ты падаешь в «статический фолбэк» и дальше ловишь ServiceNotExist(address) при ACK.

Неверный разбор баланса Ledger (BigNumberish null)
В новом SDK getLedger() возвращает availableBalance и totalBalance, а не старые balance/locked. Если читать старые поля — они null ⇒ «invalid BigNumberish (value=null)».

ACK обязателен и требует правильной цепочки вызовов
Порядок сейчас такой:
listService() → для выбранного провайдера acknowledgeProviderSigner(provider) → getServiceMetadata(provider) → getRequestHeaders(provider, content) → запрос к endpoint.

ENV противоречивый / смешанный режим
У тебя включён NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE=true, но в логах виден серверный кошелёк (Wallet address: 0x4323…) и сервер создаёт брокер. Выбери один режим:

Кастодиальный: серверный приватник → все шаги (ACK/headers) на бэкенде.

Не кастодиальный: клиентский EIP-1193 кошелёк → ACK/headers на клиенте.
Смешение двух путей часто ломает заголовки/ACK.

OpenAI фолбэк
Логи OpenAI SDK failed: Connection error — это твой «фолбэк-код». Если ты не хочешь, чтобы он вообще дергался — огради это флагом.

Что конкретно поменять у тебя (патчи)
A. Обнови ABI InferenceServing

В web/lib/contracts/abis.ts структура сервиса должна включать additionalInfo и правильный порядок. По d.ts из SDK это такой tuple:

// Сигнатурная часть структуры сервиса (пример для ABI):
"components": [
  { "name": "provider",       "type": "address" },
  { "name": "serviceType",    "type": "string"  },
  { "name": "url",            "type": "string"  },
  { "name": "model",          "type": "string"  },
  { "name": "verifiability",  "type": "string"  },
  { "name": "inputPrice",     "type": "uint256" },
  { "name": "outputPrice",    "type": "uint256" },
  { "name": "additionalInfo", "type": "string"  },
  { "name": "updatedAt",      "type": "uint256" }
]


Порядок может отличаться в конкретной реализации, но эти поля должны присутствовать (особенно additionalInfo, verifiability). Возьми точную сигнатуру из твоего архива 0g-serving-user-broker (там в cli.commonjs/sdk/inference/contract/typechain/InferenceServing.d.ts и соседних d.ts видно состав структур).

B. Исправь разбор Ledger

Везде, где ты читаешь баланс, меняй на:

const ledger = await broker.ledger.getLedger()
// Новые поля:
const available = ledger?.availableBalance ?? 0n
const total     = ledger?.totalBalance     ?? 0n
// Старые поля не использовать (balance/locked могут быть null)


Инициализация счёта:

if (!ledger || total === 0n) {
  await broker.ledger.addLedger(ethers.parseEther('0.05'))
}

C. Переход на «правильный» брокер и вызовы
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-user-broker'
// 1) провайдер лучше через твой rate-limited provider
const provider = create0GRateLimitedProvider(process.env.NEXT_PUBLIC_0G_RPC_URL!)

const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const broker = await createZGComputeNetworkBroker(wallet)

// 2) discovery
const services = await broker.inference.listService()

// 3) ACK обязателен для выбранного провайдера
await broker.inference.acknowledgeProviderSigner(providerAddress)

// 4) метаданные сервиса
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)

// 5) заголовки (контент обязателен!)
const headers = await broker.inference.getRequestHeaders(providerAddress, userPrompt)

// 6) запрос
const resp = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify({ model, messages })
})

// 7) (опционально TEE) верификация
const data = await resp.json()
await broker.inference.processResponse(providerAddress, data, data?.id)






INFT Integration Guide
Overview
This step-by-step guide shows you how to integrate INFTs into your applications using the 0G ecosystem. You'll learn to deploy contracts, manage metadata, and implement secure transfers.

Quick Navigation
New to INFTs? Start with INFT Overview
Need technical details? See ERC-7857 Standard
Ready to build? Continue with this guide
Prerequisites
Knowledge Requirements
✅ NFT Standards - Understanding of ERC-721 basics
✅ Smart Contracts - Solidity development experience
✅ Cryptography - Basic encryption and key management concepts
✅ 0G Ecosystem - Familiarity with 0G infrastructure components

Technical Setup
✅ Development Environment - Node.js 16+, Hardhat/Foundry
✅ 0G Testnet Account - Wallet with testnet tokens
✅ API Access - Keys for 0G Storage and Compute services

Quick Setup Checklist
# Install dependencies
npm install @0glabs/0g-ts-sdk ethers hardhat

# Set environment variables
export PRIVATE_KEY="your-private-key"
export OG_RPC_URL="https://evmrpc-testnet.0g.ai"
export OG_STORAGE_URL="https://storage-testnet.0g.ai"
export OG_COMPUTE_URL="https://compute-testnet.0g.ai"

Understanding 0G Integration
INFTs work seamlessly with 0G's complete AI infrastructure:

Component	Purpose	INFT Integration
0G Storage	Encrypted metadata storage	Stores AI agent data securely
0G DA	Proof verification	Validates transfer integrity
0G Chain	Smart contract execution	Hosts INFT contracts
0G Compute	Secure AI inference	Runs agent computations privately
Why This Architecture Matters
This integration ensures that AI agents maintain their intelligence, privacy, and functionality throughout their entire lifecycle while remaining fully decentralized.

Step-by-Step Implementation
Step 1: Initialize Your Project
# Create new project
mkdir my-inft-project && cd my-inft-project
npm init -y

# Install required dependencies
npm install @0glabs/0g-ts-sdk @openzeppelin/contracts ethers hardhat
npm install --save-dev @nomicfoundation/hardhat-toolbox

# Initialize Hardhat
npx hardhat init

Configure environment:

# Create .env file
cat > .env << EOF
PRIVATE_KEY=your_private_key_here
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_STORAGE_URL=https://storage-testnet.0g.ai
OG_COMPUTE_URL=https://compute-testnet.0g.ai
EOF

Step 2: Create INFT Smart Contract
// contracts/INFT.sol
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
}

contract INFT is ERC721, Ownable, ReentrancyGuard {
    // State variables
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;
    
    address public oracle;
    uint256 private _nextTokenId = 1;
    
    // Events
    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);
    
    constructor(
        string memory name,
        string memory symbol,
        address _oracle
    ) ERC721(name, symbol) {
        oracle = _oracle;
    }
    
    function mint(
        address to,
        string calldata encryptedURI,
        bytes32 metadataHash
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        
        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;
        
        return tokenId;
    }
    
    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant {
        require(ownerOf(tokenId) == from, "Not owner");
        require(IOracle(oracle).verifyProof(proof), "Invalid proof");
        
        // Update metadata access for new owner
        _updateMetadataAccess(tokenId, to, sealedKey, proof);
        
        // Transfer token ownership
        _transfer(from, to, tokenId);
        
        emit MetadataUpdated(tokenId, keccak256(sealedKey));
    }
    
    function authorizeUsage(
        uint256 tokenId,
        address executor,
        bytes calldata permissions
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }
    
    function _updateMetadataAccess(
        uint256 tokenId,
        address newOwner,
        bytes calldata sealedKey,
        bytes calldata proof
    ) internal {
        // Extract new metadata hash from proof
        bytes32 newHash = bytes32(proof[0:32]);
        _metadataHashes[tokenId] = newHash;
        
        // Update encrypted URI if provided in proof
        if (proof.length > 64) {
            string memory newURI = string(proof[64:]);
            _encryptedURIs[tokenId] = newURI;
        }
    }
    
    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        return _metadataHashes[tokenId];
    }
    
    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        return _encryptedURIs[tokenId];
    }
}

Step 3: Deploy and Initialize Contract
Create deployment script:

// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with account:", deployer.address);
    
    // Deploy mock oracle for testing (replace with real oracle in production)
    const MockOracle = await ethers.getContractFactory("MockOracle");
    const oracle = await MockOracle.deploy();
    await oracle.deployed();
    
    // Deploy INFT contract
    const INFT = await ethers.getContractFactory("INFT");
    const inft = await INFT.deploy(
        "AI Agent NFTs",
        "AINFT",
        oracle.address
    );
    await inft.deployed();
    
    console.log("Oracle deployed to:", oracle.address);
    console.log("INFT deployed to:", inft.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

Deploy to 0G testnet:

npx hardhat run scripts/deploy.js --network og-testnet

Step 4: Implement Metadata Management
Create metadata manager:

// lib/MetadataManager.js
const { ethers } = require('ethers');
const crypto = require('crypto');

class MetadataManager {
    constructor(ogStorage, encryptionService) {
        this.storage = ogStorage;
        this.encryption = encryptionService;
    }
    
    async createAIAgent(aiModelData, ownerPublicKey) {
        try {
            // Prepare AI agent metadata
            const metadata = {
                model: aiModelData.model,
                weights: aiModelData.weights,
                config: aiModelData.config,
                capabilities: aiModelData.capabilities,
                version: '1.0',
                createdAt: Date.now()
            };
            
            // Generate encryption key
            const encryptionKey = crypto.randomBytes(32);
            
            // Encrypt metadata
            const encryptedData = await this.encryption.encrypt(
                JSON.stringify(metadata),
                encryptionKey
            );
            
            // Store on 0G Storage
            const storageResult = await this.storage.store(encryptedData);
            
            // Seal key for owner
            const sealedKey = await this.encryption.sealKey(
                encryptionKey,
                ownerPublicKey
            );
            
            // Generate metadata hash
            const metadataHash = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes(JSON.stringify(metadata))
            );
            
            return {
                encryptedURI: storageResult.uri,
                sealedKey,
                metadataHash
            };
        } catch (error) {
            throw new Error(`Failed to create AI agent: ${error.message}`);
        }
    }
    
    async mintINFT(contract, recipient, aiAgentData) {
        const { encryptedURI, sealedKey, metadataHash } = aiAgentData;
        
        const tx = await contract.mint(
            recipient,
            encryptedURI,
            metadataHash
        );
        
        const receipt = await tx.wait();
        const tokenId = receipt.events[0].args.tokenId;
        
        return {
            tokenId,
            sealedKey,
            transactionHash: receipt.transactionHash
        };
    }
}

module.exports = MetadataManager;

Step 5: Implement Secure Transfers
Transfer preparation:

// lib/TransferManager.js
class TransferManager {
    constructor(oracle, metadataManager) {
        this.oracle = oracle;
        this.metadata = metadataManager;
    }
    
    async prepareTransfer(tokenId, fromAddress, toAddress, toPublicKey) {
        try {
            // Retrieve current metadata
            const currentURI = await this.metadata.getEncryptedURI(tokenId);
            const encryptedData = await this.storage.retrieve(currentURI);
            
            // Request oracle to re-encrypt for new owner
            const transferRequest = {
                tokenId,
                encryptedData,
                fromAddress,
                toAddress,
                toPublicKey
            };
            
            // Get oracle proof and new sealed key
            const oracleResponse = await this.oracle.processTransfer(transferRequest);
            
            return {
                sealedKey: oracleResponse.sealedKey,
                proof: oracleResponse.proof,
                newEncryptedURI: oracleResponse.newURI
            };
        } catch (error) {
            throw new Error(`Transfer preparation failed: ${error.message}`);
        }
    }
    
    async executeTransfer(contract, transferData) {
        const { from, to, tokenId, sealedKey, proof } = transferData;
        
        const tx = await contract.transfer(
            from,
            to,
            tokenId,
            sealedKey,
            proof
        );
        
        return await tx.wait();
    }
}

Best Practices
🔒 Security Guidelines
Key Management:

Store private keys in hardware wallets or HSMs
Never expose keys in code or logs
Implement automatic key rotation
Use multi-signature wallets for critical operations
Metadata Protection:

// Example: Secure metadata handling
class SecureMetadata {
    constructor() {
        this.encryptionAlgorithm = 'aes-256-gcm';
        this.keyDerivation = 'pbkdf2';
    }
    
    async encryptMetadata(data, password) {
        const salt = crypto.randomBytes(16);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(this.encryptionAlgorithm, key, iv);
        // ... encryption logic
    }
}

⚡ Performance Optimization
Efficient Storage Patterns:

Compress metadata before encryption
Use appropriate storage tiers based on access patterns
Implement lazy loading for large AI models
Cache frequently accessed data locally
Batch Operations:

// Batch multiple operations
async function batchMintINFTs(agents, recipients) {
    const operations = agents.map((agent, i) => 
        metadataManager.createAIAgent(agent, recipients[i])
    );
    
    const results = await Promise.all(operations);
    return results;
}

🧪 Testing Strategy
Comprehensive Test Suite:

// test/INFT.test.js
describe('INFT Contract', function () {
    it('should mint INFT with encrypted metadata', async function () {
        const metadata = await createTestMetadata();
        const result = await inft.mint(owner.address, metadata.uri, metadata.hash);
        expect(result).to.emit(inft, 'Transfer');
    });
    
    it('should transfer with re-encryption', async function () {
        // Test secure transfer logic
    });
    
    it('should authorize usage without ownership transfer', async function () {
        // Test authorization functionality
    });
});

Security Testing:

Test with malformed proofs
Verify access controls
Check for reentrancy vulnerabilities
Validate oracle responses
Real-World Use Cases
🏪 AI Agent Marketplace
Complete marketplace integration:

// marketplace/AgentMarketplace.js
class AgentMarketplace {
    constructor(inftContract, paymentToken) {
        this.inft = inftContract;
        this.payment = paymentToken;
        this.listings = new Map();
    }
    
    async listAgent(tokenId, price, description) {
        // Verify ownership
        const owner = await this.inft.ownerOf(tokenId);
        require(owner === msg.sender, 'Not owner');
        
        // Create listing
        const listing = {
            tokenId,
            price,
            description,
            seller: owner,
            isActive: true
        };
        
        this.listings.set(tokenId, listing);
        
        // Approve marketplace for transfer
        await this.inft.approve(this.address, tokenId);
        
        return listing;
    }
    
    async purchaseAgent(tokenId, buyerPublicKey) {
        const listing = this.listings.get(tokenId);
        require(listing && listing.isActive, 'Agent not for sale');
        
        // Prepare secure transfer
        const transferData = await this.prepareTransfer(
            tokenId,
            listing.seller,
            msg.sender,
            buyerPublicKey
        );
        
        // Execute payment
        await this.payment.transferFrom(msg.sender, listing.seller, listing.price);
        
        // Execute secure transfer
        await this.inft.transfer(
            listing.seller,
            msg.sender,
            tokenId,
            transferData.sealedKey,
            transferData.proof
        );
        
        // Remove listing
        this.listings.delete(tokenId);
    }
}

💼 AI-as-a-Service Platform
Usage authorization system:

// services/AIaaS.js
class AIaaSPlatform {
    async createSubscription(tokenId, subscriber, duration, permissions) {
        // Verify agent ownership
        const owner = await this.inft.ownerOf(tokenId);
        
        // Create usage authorization
        const authData = {
            subscriber,
            expiresAt: Date.now() + duration,
            permissions: {
                maxRequests: permissions.maxRequests,
                allowedOperations: permissions.operations,
                rateLimit: permissions.rateLimit
            }
        };
        
        // Grant usage rights
        await this.inft.authorizeUsage(
            tokenId,
            subscriber,
            ethers.utils.toUtf8Bytes(JSON.stringify(authData))
        );
        
        return authData;
    }
    
    async executeAuthorizedInference(tokenId, input, subscriber) {
        // Verify authorization
        const auth = await this.getAuthorization(tokenId, subscriber);
        require(auth && auth.expiresAt > Date.now(), 'Unauthorized');
        
        // Execute inference on 0G Compute
        const result = await this.ogCompute.executeSecure({
            tokenId,
            executor: subscriber,
            input,
            verificationMode: 'TEE'
        });
        
        // Update usage metrics
        await this.updateUsageMetrics(tokenId, subscriber);
        
        return result;
    }
}

🤝 Multi-Agent Collaboration
Agent composition framework:

// collaboration/AgentComposer.js
class AgentComposer {
    async composeAgents(agentTokenIds, compositionRules) {
        // Verify ownership of all agents
        for (const tokenId of agentTokenIds) {
            const owner = await this.inft.ownerOf(tokenId);
            require(owner === msg.sender, `Not owner of agent ${tokenId}`);
        }
        
        // Create composite agent metadata
        const compositeMetadata = {
            type: 'composite',
            agents: agentTokenIds,
            rules: compositionRules,
            createdAt: Date.now()
        };
        
        // Encrypt and store composite metadata
        const encryptedComposite = await this.metadataManager.createAIAgent(
            compositeMetadata,
            msg.sender
        );
        
        // Mint new INFT for composite agent
        const result = await this.inft.mint(
            msg.sender,
            encryptedComposite.encryptedURI,
            encryptedComposite.metadataHash
        );
        
        return result.tokenId;
    }
    
    async executeCompositeInference(compositeTokenId, input) {
        // Retrieve composite metadata
        const metadata = await this.getDecryptedMetadata(compositeTokenId);
        
        // Execute inference on each component agent
        const agentResults = await Promise.all(
            metadata.agents.map(agentId => 
                this.executeAgentInference(agentId, input)
            )
        );
        
        // Apply composition rules to combine results
        const finalResult = this.applyCompositionRules(
            agentResults,
            metadata.rules
        );
        
        return finalResult;
    }
}

Troubleshooting
Common Issues & Solutions
Transfer Failures
Problem: INFT transfer transaction reverts

Causes & Solutions:

Invalid proof: Verify oracle is online and proof is correctly formatted
Expired proof: Generate new proof (proofs have limited validity)
Wrong owner: Ensure from address matches actual token owner
Oracle unavailable: Check oracle service status
// Debug transfer issues
async function debugTransfer(tokenId, proof) {
    const owner = await inft.ownerOf(tokenId);
    console.log(`Token owner: ${owner}`);
    
    const isValidProof = await oracle.verifyProof(proof);
    console.log(`Proof valid: ${isValidProof}`);
    
    // Check oracle status
    const oracleStatus = await oracle.getStatus();
    console.log(`Oracle status: ${oracleStatus}`);
}

Metadata Access Issues
Problem: Cannot decrypt or access AI agent metadata

Solutions:

Verify private key corresponds to sealed key
Check storage URI accessibility
Ensure metadata hasn't been corrupted
Validate encryption algorithm compatibility
// Test metadata access
async function testMetadataAccess(tokenId, privateKey) {
    try {
        const encryptedURI = await inft.getEncryptedURI(tokenId);
        const encryptedData = await storage.retrieve(encryptedURI);
        
        // Attempt decryption
        const sealedKey = await getSealedKey(tokenId);
        const key = await unsealKey(sealedKey, privateKey);
        const metadata = await decrypt(encryptedData, key);
        
        console.log('Metadata accessible:', !!metadata);
        return metadata;
    } catch (error) {
        console.error('Metadata access failed:', error.message);
    }
}

High Gas Costs
Optimization strategies:

Compress proofs before submission
Use batch operations for multiple transfers
Optimize storage patterns
Consider Layer 2 solutions
// Optimize gas usage
async function optimizedTransfer(transfers) {
    // Batch multiple transfers
    const batchData = transfers.map(t => ({
        tokenId: t.tokenId,
        from: t.from,
        to: t.to,
        sealedKey: compressData(t.sealedKey),
        proof: compressProof(t.proof)
    }));
    
    return await inft.batchTransfer(batchData);
}
0G Compute SDK
The 0G Compute Network SDK enables developers to integrate AI inference services from the 0G Compute Network into their applications. Currently, the 0G Compute Network SDK supports Large Language Model (LLM) inference services, with fine-tuning and additional features planned for future releases.

In just five minutes, you can initialize your broker to manage operations, set up and fund your account to pay for inference services, and learn how to send inference requests and handle responses.

Quick Start
Installation
pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0

Core Concepts
1. The Broker
Your interface to the 0G Compute Network:

Handles authentication and billing
Manages provider connections
Verifies computations
2. Providers
GPU owners offering AI services:

Each has a unique address
Set their own prices
Run specific models
3. Prepaid Accounts
Fund account before usage
Automatic micropayments
No surprise bills
Step-by-Step Guide
Initialize the Broker
Using Private Key
Browser Wallet
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

Fund Your Account
// Add 0.1 OG tokens (~10,000 requests)
await broker.ledger.addLedger(ethers.parseEther("0.1"));

// Check balance
const account = await broker.ledger.getLedger();
console.log(`Balance: ${ethers.formatEther(account.balance)} OG`);

Discover Available Services
The 0G Compute Network hosts multiple AI service providers. The service discovery process helps you find and select the appropriate services for your needs.

🎯 Official 0G Services
Model	Provider Address	Description	Verification
llama-3.3-70b-instruct	0xf07240Efa67755B5311bc75784a061eDB47165Dd	State-of-the-art 70B parameter model for general AI tasks	TEE (TeeML)
deepseek-r1-70b	0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3	Advanced reasoning model optimized for complex problem solving	TEE (TeeML)
const services = await broker.inference.listService();

Each service contains the following information:

type ServiceStructOutput = {
  provider: string; // Provider's wallet address (unique identifier)
  serviceType: string; // Type of service
  url: string; // Service URL
  inputPrice: bigint; // Price for input processing
  outputPrice: bigint; // Price for output generation
  updatedAt: bigint; // Last update timestamp
  model: string; // Model identifier
  verifiability: string; // Indicates how the service's outputs can be verified. 'TeeML' means it runs with verification in a Trusted Execution Environment. An empty value means no verification.
};


Acknowledge Provider
Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

await broker.inference.acknowledgeProviderSigner(providerAddress)

The providerAddress can be obtained from from service metadata. For details on how to retrieve it, see Discover Available Services

Service Requests
Service usage in the 0G Network involves two key steps:

Retrieving service metadata
Generating authenticated request headers
  
  // Get service details
  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
  
  // Generate auth headers (single use)
  const headers = await broker.inference.getRequestHeaders(provider, question);
  

Send a Request to the Service
Using Fetch API
Using OpenAI SDK
const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      messages: [{ role: "user", content: question }],
      model: model,
    }),
  });
  
const data = await response.json();
const answer = data.choices[0].message.content;


Response Processing
This function is used to verify the response. If it is a verifiable service, it will return whether the response is valid.

const valid = await broker.inference.processResponse(
  providerAddress,
  content,
  chatID // Optional: Only for verifiable services
);

Fee Settlement
Fee settlement by the broker service occurs at scheduled intervals.

Account Management
Check Balance
const ledger = await broker.ledger.getLedger();
console.log(`
  Balance: ${ethers.formatEther(ledger.balance)} OG
  Locked: ${ethers.formatEther(ledger.locked)} OG
  Available: ${ethers.formatEther(ledger.balance - ledger.locked)} OG
`);

Add Funds
// Add more funds
await broker.ledger.depositFund(ethers.parseEther("0.5"));

Request Refund
// Withdraw unused funds
const amount = ethers.parseEther("0.1");
await broker.ledger.retrieveFund("inference", amount);

Troubleshooting
Common Issues
Error: Insufficient balance
Your account doesn't have enough funds. Add more:

await broker.ledger.addLedger(ethers.parseEther("0.1"));

Error: Headers already used
Request headers are single-use. Generate new ones for each request:

// ❌ Wrong
const headers = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers);
await makeRequest(headers); // Will fail!

// ✅ Correct
const headers1 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers1);
const headers2 = await broker.inference.getRequestHeaders(provider, content);
await makeRequest(headers2);

Error: Provider not responding
The provider might be offline. Try another:

// Try all official providers
for (const [model, provider] of Object.entries(OFFICIAL_PROVIDERS)) {
  try {
    console.log(`Trying ${model}...`);
    return await makeRequestToProvider(provider);
  } catch (e) {
    console.log(`${model} failed, trying next...`);
    continue; // Try next provider
  }
}
0g-ts-sdk
This is the JavaScript SDK for 0g-storage. Features include:

 File Merkle Tree Class
 Flow Contract Types
 RPC methods support
 File upload
 Support browser environment
 Tests for different environments
 File download
Install
npm install @0glabs/0g-ts-sdk ethers
ethers is a peer dependency of this project.

Usage
Node.js environment ESM example:
Use ZgFile to create a file object, then call merkleTree method to get the merkle tree of the file.

import { Indexer, ZgFile } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';
import { exit } from 'process';

const file = await ZgFile.fromFilePath(<file_path>);
var [tree, err] = await file.merkleTree();
if (err === null) {
  console.log("File Root Hash: ", tree.rootHash());
} else {
  exit(1);
}
await file.close();
Upload file to 0g-storage:

import { getFlowContract } from '@0glabs/0g-ts-sdk';
const evmRpc = 'https://evmrpc-testnet.0g.ai';
const privateKey = ''; // with balance to pay for gas
const indRpc = 'https://indexer-storage-testnet-turbo.0g.ai'; // indexer rpc

const provider = new ethers.JsonRpcProvider(evmRpc);
const signer = new ethers.Wallet(privateKey, provider);

const indexer = new Indexer(indRpc);
// need to pay fees to store data in storage nodes
var [tx, err] = await indexer.upload(file, evmRpc, signer);
if (err === null) {
  console.log("File uploaded successfully, tx: ", tx);
} else {
  console.log("Error uploading file: ", err);
}
Download file from 0g-storage

err = await indexer.download(<root_hash>, <output_file>, <with_proof>);
if (err !== null) {
  console.log("Error downloading file: ", err);
}
Upload data to 0g-kv:

var [nodes, err] = await indexer.selectNodes(1);
if (err !== null) {
    console.log("Error selecting nodes: ", err);
    stop();
}

const batcher = new Batcher(1, nodes, flowContract, evmRpc);

const key1 = Uint8Array.from(Buffer.from("TESTKEY0", 'utf-8'));
const val1 = Uint8Array.from(Buffer.from("TESTVALUE0", 'utf-8'));
const key2 = Uint8Array.from(Buffer.from("TESTKEY1", 'utf-8'));
const val2 = Uint8Array.from(Buffer.from("TESTVALUE1", 'utf-8'));
batcher.streamDataBuilder.set("0x...", key1, val1);
batcher.streamDataBuilder.set("0x...", key2, val2);

var [tx, err] = await batcher.exec();

if (err === null) {
    console.log("Batcher executed successfully, tx: ", tx);
} else {
    console.log("Error executing batcher: ", err);
}
Download data from 0g-kv

const KvClientAddr = "http://3.101.147.150:6789"

const streamId = "0x..."
const kvClient = new KvClient(KvClientAddr)

let val = await kvClient.getValue(streamId, ethers.encodeBase64(key1));
console.log(val)
Browser environment example:
Import zgstorage.esm.js in your html file:

<script type="module">
  import { Blob, Indexer } from "./dist/zgstorage.esm.js";
  // Your code here...
</script>
Create file object from blob:

const file = new Blob(blob);
const [tree, err] = await file.merkleTree();
if (err === null) {
  console.log("File Root Hash: ", tree.rootHash());
}
File upload is same with node.js environment with the following provider change

import { BrowserProvider } from 'ethers';  // or from ethers.js url

let provider = new BrowserProvider(window.ethereum) // metamask need to be installed
Vite example:
To use the SDK with Vite, set up polyfills in your vite.config.ts:

import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    ...
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'events'],
    }),
  ],
});
Now, you can import SDK files with the /browser suffix:

import { Indexer, Blob } from '@0glabs/0g-ts-sdk/browser';
Check codes in examples for more details.

Contribute
This project uses pnpm as package manager. After cloning the project, run pnpm install to install dependencies.

Generate Contract Flow Types
Make sure 0g-storage-contracts is in project sibling directory.

pnpm gen-contract-type-flow
pnpm gen-contract-type-market

0G Serving Broker Documentation
Overview
This document provides an overview of the 0G Serving Broker, including setup and usage instructions.

Setup and Usage
To integrate the 0G Serving Broker into your project, follow these steps

Step 1: Install the dependency
To get started, you need to install the @0glabs/0g-serving-broker package:

pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0
Step 2: Initialize a Broker Instance
The broker instance is initialized with a signer. This signer is an instance that implements the JsonRpcSigner or Wallet interface from the ethers package and is used to sign transactions for a specific Ethereum account. You can create this instance using your private key via the ethers library or use a wallet framework tool like wagmi to initialize the signer.

import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

/**
 * 'createZGComputeNetworkBroker' is used to initialize ZGServingUserBroker
 *
 * @param {JsonRpcSigner | Wallet} signer - A signer that implements the 'JsonRpcSigner' or 'Wallet' interface from the ethers package.
 * @param {string} contractAddress - 0G Serving contract address, use default address if not provided.
 *
 * @returns broker instance.
 *
 * @throws An error if the broker cannot be initialized.
 */
const broker = await createZGComputeNetworkBroker(signer)
Step 3: List Available Services
/**
 * 'listService' retrieves a list of services from the contract.
 *
 * @returns {Promise<ServiceStructOutput[]>} A promise that resolves to an array of ServiceStructOutput objects.
 * @throws An error if the service list cannot be retrieved.
 *
 * type ServiceStructOutput = {
 *   provider: string;  // Address of the provider
 *   serviceType: string;
 *   url: string;
 *   inputPrice: bigint;
 *   outputPrice: bigint;
 *   updatedAt: bigint;
 *   model: string;
 *   verifiability: string; // Indicates how the service's outputs can be verified. 'TeeML' means it runs with verification in a Trusted Execution Environment. An empty value means no verification.
 *   additionalInfo: string // Provider-defined metadata, currently used to store the provider's encrypted key, but can be extended to include other custom information in future.
 * };
 */
const services = await broker.listService()
Step 4: Manage Accounts
Before using the provider's services, you need to create an account specifically for the chosen provider. The provider checks the account balance before responding to requests. If the balance is insufficient, the request will be denied.

4.1 Create an Account
/**
 * 'addAccount' creates a new account in the contract.
 *
 * @param {number} balance - The initial balance to be assigned to the new account. The unit is A0GI.
 *
 * @throws  An error if the account creation fails.
 */
await broker.ledger.addLedger(balance)
4.2 Deposit Funds into the Account
/**
 * 'depositFund' deposits a specified amount of funds into an existing account.
 *
 * @param {number} amount - The amount of funds to be deposited. The unit is A0GI.
 *
 * @throws  An error if the deposit fails.
 */
await broker.ledger.depositFund(amount)
Step 5: Use the Provider's Services
5.1 Get Service metadata
/**
 * 'getServiceMetadata' returns metadata for the provider service.
 * Includes:
 * 1. Service endpoint of the provider service
 * 2. Model information for the provider service
 *
 * @param {string} providerAddress - The address of the provider.
 *
 * @returns { endpoint, model } - Object containing endpoint and model.
 *
 * @throws An error if errors occur during the processing of the request.
 */
const { endpoint, model } = await broker.getServiceMetadata(providerAddress)
5.2 Acknowledge Provider
Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

/**
 * Acknowledge the given provider address.
 *
 * @param {string} providerAddress - The address of the provider identifying the account.
 * 
 *  @throws Will throw an error if failed to acknowledge.
 */
await broker.inference.acknowledgeProviderSigner(providerAddress)
5.3 Get Request Headers
/**
 * 'getRequestHeaders' generates billing-related headers for the request
 * when the user uses the provider service.
 *
 * In the 0G Serving system, a request with valid billing headers
 * is considered a settlement proof and will be used by the provider
 * for settlement in contract.
 *
 * @param {string} providerAddress - The address of the provider.
 * @param {string} content - The content being billed. For example, in a chatbot service, it is the text input by the user.
 *
 * @returns headers. Records information such as the request fee and user signature.
 *
 * @throws An error if errors occur during the processing of the request.
 */
const headers = await broker.inference.getRequestHeaders(
    providerAddress,
    content
)
5.4 Send Request
After obtaining the endpoint, model, and headers, you can use client SDKs compatible with the OpenAI interface to make requests.

Note: Fee settlement by the broker service occurs at scheduled intervals.

Note: Generated headers are valid for a single use only and cannot be reused.

/**
 * Any SDK request methods that follow the OpenAI interface specifications can also be used.
 *
 * Here is an example using the OpenAI TS SDK.
 */
const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: '',
})
const completion = await openai.chat.completions.create(
    {
        messages: [{ role: 'system', content }],
        model: model,
    },
    {
        headers: {
            ...headers,
        },
    }
)

/**
 * Alternatively, you can also use `fetch` to make the request.
 */
await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...headers,
    },
    body: JSON.stringify({
        messages: [{ role: 'system', content }],
        model: model,
    }),
})
5.5 Process Responses
/**
 * 'processResponse' is used after the user successfully obtains a response from the provider service.
 *
 * Additionally, if the service is verifiable,
 * input the chat ID from the response and 'processResponse' will determine the validity of the
 * returned content by checking the provider service's response and corresponding signature associated
 * with the chat ID.
 *
 * @param {string} providerAddress - The address of the provider.
 * @param {string} content - The main content returned by the service. For example, in the case of a chatbot service,
 * it would be the response text.
 * @param {string} chatID - Only for verifiable services. You can provide the chat ID obtained from the response to
 * automatically download the response signature. The function will verify the reliability of the response
 * using the service's signing address.
 *
 * @returns A boolean value. True indicates the returned content is valid, otherwise it is invalid.
 *
 * @throws An error if any issues occur during the processing of the response.
 */
const valid = await broker.inference.processResponse(
    providerAddress,
    content,
    chatID
)
Interface
Access the more details of interfaces via cloning the repo and opening index.html in browser.


