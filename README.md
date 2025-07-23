Fine-tuning CLI
Customize AI models with your own data using 0G's distributed GPU network.

Quick Start
Prerequisites
Node version >= 22.0.0

Install CLI
pnpm install @0glabs/0g-serving-broker -g

Set Environment
export RPC_ENDPOINT=https://evmrpc-testnet.0g.ai  # Optional, this is default
export ZG_PRIVATE_KEY=your_private_key_here

Create Account & Add Funds
The Fine-tuning CLI requires an account to pay for service fees via the 0G Compute Network. You can create an account with the following command:

# Create account with 0.1 OG
0g-compute-cli add-account --amount 0.1

List Providers
0g-compute-cli list-providers

The output will be like:

┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider 1                                       │ 0xf07240Efa67755B5311bc75784a061eDB47165Dd       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Available                                        │ ✓                                                │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Price Per Byte in Dataset (OG)                   │ 0.000000000000000001                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider 2                                       │ ......                                           │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ ......                                           │ ......                                           │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

Provider x: The address of the provider. The address of the official provider is 0xf07240Efa67755B5311bc75784a061eDB47165Dd.
Available: Indicates if the provider is available. If ✓, the provider is available. If ✗, the provider is occupied.
Price Per Byte in Dataset (OG): The service fee charged by the provider. The fee is currently based on the byte count of the dataset. Future versions may charge more accurately based on the token count of the dataset.
List Models
# List available models
0g-compute-cli list-models

📋 Available Models Summary
The output consists of two main sections:

Predefined Models: These are models that are provided by the system as predefined options. They are typically built-in, curated, and maintained to ensure quality, reliability, and broad applicability across common use cases.

Provider's Model: These models are offered by external service providers. Providers may customize or fine-tune models to address specific needs, industries, or advanced use cases. The availability and quality of these models may vary depending on the provider.

Note: We currently offer the models listed above as presets. You can choose one of these models for fine-tuning. More models will be provided in future versions.

Prepare Configuration File
Please download the parameter file template for the model you wish to fine-tune from the releases page and modify it according to your needs.

Note: For custom models provided by third-party Providers, you can download the usage template including instructions on how to construct the dataset and training configuration using the following command:

0g-compute-cli model-usage --provider <PROVIDER_ADDRESS>  --model <MODEL_NAME>   --output <PATH_TO_SAVE_MODEL_USAGE>


Prepare Your Data
Please download the dataset format specification and verification script from the releases page to make sure your generated dataset complies with the requirements.

Upload Dataset
# Upload to 0G Storage
0g-compute-cli upload --data-path <PATH_TO_DATASET>

# Output: Root hash: 0xabc123... (save this!)

Record the root hash of the dataset; they will be needed in later steps.

Calculate Dataset Size
After uploading the dataset to storage, you can calculate its size by running the following command:

0g-compute-cli calculate-token \
  --model <MODEL_NAME> \
  --dataset-path <PATH_TO_DATASET> \
  --provider <PROVIDER_ADDRESS>

Create Task
After calculating the dataset size, you can create a task by running the following command:

0g-compute-cli create-task \
  --provider <PROVIDER_ADDRESS> \
  --model <MODEL_NAME> \
  --dataset <DATASET_ROOT_HASH> \
  --config-path <PATH_TO_CONFIG_FILE> \
  --data-size <DATASET_SIZE>

Parameters:

Parameter	Description
--provider	Address of the service provider
--model	Name of the pretrained model
--dataset	Root hash of the dataset on 0G Storage
--config-path	Path to the parameter file
--data-size	Size of the dataset
--gas-price	Gas price (optional)
The output will be like:

Verify provider...
Provider verified
Creating task...
Created Task ID: 6b607314-88b0-4fef-91e7-43227a54de57

Note: When creating a task for the same provider, you must wait for the previous task to be completed (status Finished) before creating a new task. If the provider is currently running other tasks, you will be prompted to choose between adding your task to the waiting queue or canceling the request.

Monitor Progress
You can monitor the progress of your task by running the following command:

0g-compute-cli get-task --provider <PROVIDER_ADDRESS> --task <TASK_ID>

The output will be like:

┌───────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
│ Field                             │ Value                                                                               │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ ID                                │ beb6f0d8-4660-4c62-988d-00246ce913d2                                                │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Created At                        │ 2025-03-11T01:20:07.644Z                                                            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Pre-trained Model Hash            │ 0xcb42b5ca9e998c82dd239ef2d20d22a4ae16b3dc0ce0a855c93b52c7c2bab6dc                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Dataset Hash                      │ 0xaae9b4e031e06f84b20f10ec629f36c57719ea512992a6b7e2baea93f447a5fa                  │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Training Params                   │ {......}                                                                            │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Fee (neuron)                      │ 179668154                                                                           │
├───────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ Progress                          │ Delivered                                                                           │
└───────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘


Field Descriptions:

ID: Unique identifier for your fine-tuning task
Pre-trained Model Hash: Storage reference for the base model being fine-tuned
Dataset Hash: Storage reference for your training dataset
Training Params: Configuration parameters used during fine-tuning
Fee (neuron): Total cost for the fine-tuning task
Progress: Task status. Possible values are Init, SettingUp, SetUp, Training, Trained, Delivering, Delivered, UserAcknowledged, Finished, Failed. These represent the following states, respectively:
Init: Task submitted
SettingUp: Provider is preparing the environment to run the task
SetUp: Provider is ready to start training the model
Training: Provider is training the model
Trained: provider has finished the training
Delivering: Provider is uploading the fine-tuning result to storage
Delivered: provider has uploaded the fine-tuning result
UserAcknowledged: User has confirmed the result is downloadable
Finished: Task is completed
Failed: Task failed
View Task Logs
You can view the logs of your task by running the following command:

0g-compute-cli get-log --provider <PROVIDER_ADDRESS> --task <TASK_ID>

The output will be like:

creating task....
Step: 0, Logs: {'loss': ..., 'accuracy': ...}
...
Training model for task beb6f0d8-4660-4c62-988d-00246ce913d2 completed successfully

Confirm Task Result
Use the Check Task command to view task status. When the status changes to Delivered, it indicates that the provider has completed the fine-tuning task and uploaded the result to storage. The corresponding root hash has also been saved to the contract. You can download the model with the following command; CLI will download the model based on the root hash submitted by the provider. If the download is successful, CLI updates the contract information to confirm the model is downloaded.

0g-compute-cli acknowledge-model --provider <PROVIDER_ADDRESS>  --data-path <PATH_TO_SAVE_MODEL>

Note: The model file downloaded with the above command is encrypted, and additional steps are required for decryption.

Decrypt Model
The provider will check the contract to verify if the user has confirmed the download, enabling the provider to settle fees successfully on the contract subsequently. Once the provider confirms the download, it uploads the key required for decryption to the contract, encrypted with the user's public key, and collects the fee. You can again use the get-task command to view the task status. When the status changes to Finished, it means the provider has uploaded the key. At this point, you can decrypt the model with the following command:

0g-compute-cli decrypt-model --provider <PROVIDER_ADDRESS> --encrypted-model <PATH_TO_ENCRYPTED_MODEL> --output <PATH_TO_SAVE_DECRYPTED_MODEL>


The above command performs the following operations:

Gets the encrypted key from the contract uploaded by the provider
Decrypts the key using the user's private key
Decrypts the model with the decrypted key
Note: The decrypted result will be saved as a zip file. Ensure that the <PATH_TO_SAVE_DECRYPTED_MODEL> ends with .zip (e.g., model_output.zip). After downloading, unzip the file to access the decrypted model.

Account Management
View Account
0g-compute-cli get-account

Possible output:

  Overview
┌──────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│ Balance                                          │ Value (OG)                                                                      │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Total                                            │ 0.999999999820331942                                                            │
├──────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ Locked (transferred to sub-accounts)             │ 0.000000000179668154                                                            │
└──────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

  Fine-tuning sub-accounts (Dynamically Created per Used Provider)
┌──────────────────────────────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────────┐
│ Provider                                         │ Balance (OG)                 │ Requested Return to Main Account (OG)            │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC       │ 0.000000000179668154         │ 0.000000000000000000                             │
├──────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────────────────────────────┤
│ ......                                           │ ......                       │ ......                                           │
└──────────────────────────────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────────┘


Overview: Provides a general overview of the account's balance.

Total: The current balance of the account
Locked: The cumulative amount locked in all sub-accounts
Fine-tuning sub-accounts: Information about sub-accounts, with each sub-account corresponding to a provider for paying the provider's service fee. Each sub-account is dynamically created when tasks are submitted.

Provider: Address of the provider corresponding to the sub-account
Balance: Balance of the sub-account, which is an amount transferred from the main account to the sub-account based on the task fee whenever a task is created.
Requested Return to Main Account: Amount requested to be returned from sub-accounts to the main account. If the amount in the sub-account goes unspent for any reason, such as a task failure, you can use the return-funds command to return the balance to the main account. However, it won't return immediately and will only be available after a lock-in period. For details, refer to Retrieving Funds.
Note: For more information about sub-accounts, refer to View Sub-Account.

Deposit
You can deposit into your account using the following command.

0g-compute-cli deposit --amount <AMOUNT>

Withdrawal
You can withdraw to your wallet with the following command:

0g-compute-cli refund --amount <AMOUNT>

Note: You can't withdraw the "Lock" amount in the account; only the "Total-Lock" portion can be withdrawn.

View Sub-Account
Sub-accounts are dynamically created when tasks are submitted and used to pay provider service fees. You can view sub-account information with the following command:

0g-compute-cli get-sub-account --provider <PROVIDER_ADDRESS>

Possible output:

  Overview
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Field                                            │ Value                                            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Provider                                         │ 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC       │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Balance (OG)                                     │ 0.000000000179668154                             │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ Funds Applied for Return to Main Account (OG)    │ 0.000000000179668154                             │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Details of Each Amount Applied for Return to Main Account
┌──────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
│ Amount (OG)                                      │ Remaining Locked Time                            │
├──────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 0.000000000179668154                             │ 23h 58min 34s                                    │
└──────────────────────────────────────────────────┴──────────────────────────────────────────────────┘

  Deliverables
┌───────────────────────────────────────────────────────────────────────────┬─────────────────────────┐
│ Root Hash                                                                 │ Access Confirmed         │
├───────────────────────────────────────────────────────────────────────────┼─────────────────────────┤
│ 0x24951e897b1203e8aa1692736837f089a95b70390cc02723505e41ebf9              │ ✓                       │
│ cac70c                                                                    │                         │
├───────────────────────────────────────────────────────────────────────────┼─────────────────────────┤
│ 0x85b3869bcf14569bb41c3d7d499c9a8eb441e6d606bbe3e10e0fac90e5              │                         │
│ 7d36a4                                                                    │                         │
└───────────────────────────────────────────────────────────────────────────┴─────────────────────────┘

Overview: An overview of the account

Provider: Address of the provider corresponding to the sub-account
Balance: Balance of the sub-account. The main account transfers a certain amount to the sub-account based on the task fee every time a task is created.
Funds Applied for Return to Main Account: Amount in the sub-account requested to be returned to the main account
Details of Each Amount Applied for Return to Main Account: Detailed information about amounts requested to be returned to the main account

Amount: Amount requested to be returned to the main account
Remaining Locked Time: Remaining locked time for the return amount to be available in the main account
Deliverables: Deliverables issued by the provider after task completion

Root Hash: Root hash of the model uploaded to storage
Access Confirmed: Indicates whether the user has confirmed download access to the model based on the root hash
Retrieve Funds
The retrieve funds operation returns the balance from sub-accounts to the main account. This operation is asynchronous and will execute after a specific locking period of 24 hours. The lock time ensures provider rights protection, preventing the user from immediately returning the balance to the main account after provider services are rendered and stopping the provider from getting paid.

0g-compute-cli retrieve-fund

The above command requests the balance from all sub-accounts to be returned to the main account. After the lock-in period elapses, execute the retrieve-fund command again to refund all the amounts whose locking period has concluded to the main account. Check the refund status using the View Sub-Account command.

Other Commands
View Task List
You can view the list of tasks submitted to a specific provider using the following command:

0g-compute-cli list-tasks  --provider <PROVIDER_ADDRESS>

Download Data
You can download previously uploaded datasets using the command below:

0g-compute-cli download --data-path <PATH_TO_SAVE_DATASET> --data-root <DATASET_ROOT_HASH>

Cancel a Task
You can cancel a task before it starts running using the following command:

0g-compute-cli cancel-task --provider <PROVIDER_ADDRESS> --task <TASK_ID>

Note: Tasks that are already in progress or completed cannot be canceled.

Troubleshooting
Error: Provider busy
The provider is processing another task. Options:

Wait and retry later
Use a different provider: 0g-compute-cli list-providers
Queue your task (you'll be prompted)
Error: Insufficient balance
Add more funds:

0g-compute-cli deposit --amount 0.1

Previous
Inference SDK
Next

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


# Agent NFT
## Introduction
With the increasing intelligence of AI models, agents have become increasingly powerful in helping people process meaningful daily tasks automatically. In the blockchain industry, many projects have provided functionality for users to create agents. This trend will continue, and "agent x crypto" has been recognized as one of the biggest narratives in the coming years. Currently, a key missing element is the decentralized management of agent ownership. Specifically, when you create an agent on platforms like Virtuals or EternalAI, there is no on-chain information to verify that the agent you created belongs to you. We believe NFTs could provide a key solution to this problem.

However, there are challenges in simply using existing NFT standards like ERC721 to represent agents. One major reason is that when transferring an agent NFT token, we are not only transferring the tokenId ownership but also the ownership of the metadata. The metadata of an agent is so valuable (it could be the primary purpose of the transfer) that it is often stored in a private environment or in a public environment with encryption. Therefore, the actual transfer of agent metadata needs to be done in a privacy-preserving and verifiable manner. ERC721 lacks the capability to fulfill this type of transfer.

## Our Scheme

We therefore propose a new NFT standard, ERC7857, to address this problem. To better understand how this new protocol works, let's first examine how the metadata can be transferred privately and verified in the ERC7857 smart contract. The transfer() interface accepts a proof parameter which verifies the following conditions. For better understanding, we abstract the process of proof generation and verification as an interaction with an ideal oracle that always provides truthful responses. When querying the oracle about a 'newDataHash', it replies with:

1. The 'oldDataHash' representing the data encrypted from the original metadata with a key held by the sender

2. The 'newDataHash' representing the data encrypted from the original metadata with a new key

3. Whether the receiver can access the data behind the 'newDataHash'

4. The 'sealedKey' containing the new key encrypted with the receiver's public key

The process can be illustrated as follows and is shown in Fig.1. When the sender invokes transfer(), the contract queries the oracle about the target 'newDataHash'. The oracle replies with a pair of 'oldDataHash' and 'newDataHash', which contain data encrypted from the original metadata with the old and new keys respectively. The oracle also confirms whether the receiver can access the data behind the 'newDataHash' and provides a 'sealedKey' that is encrypted with the receiver's public key. If the oracle say 'yes', the contract changes the token's owner from sender to receiver, updates the token's 'oldDataHash' to 'newDataHash', and publishes the 'sealedKey'. The receiver can then access the original metadata using the key decrypted from 'sealedKey' with their private key. This ideal oracle can be implemented using either TEE or ZKP in this protocol.

![Oracle overview](doc/img/oracle_overview.jpeg)

Now, let's examine the oracle implementations. The TEE implementation is shown in Fig.2. The sender transmits the 'oldDataHash', hash-identified data, and encrypted key to the TEE, with the key encrypted using TEE's public key to ensure only TEE can access it. TEE then decrypts the encrypted key with its private key to obtain the old key and decrypts the 'oldDataHash'-identified data to retrieve the original metadata. TEE generates a new key securely and re-encrypts the original metadata with the new key to create the 'newDataHash'. TEE also encrypts the new key with the receiver's public key to generate the 'sealedKey'. Finally, TEE outputs the 'sealedKey', 'oldDataHash', and 'newDataHash'.

![TEE oracle](doc/img/tee_oracle.jpeg)

It should be noted that in Fig.2 and Fig.3, TEE can generate a new key securely to prevent the sender from accessing it, while ZKP cannot - this represents a significant difference between the two approaches. Consequently, in ZKP-implemented oracles, the receiver should change their key when next updating the data.

![ZKP oracle](doc/img/zkp_oracle.jpeg)

In summary, the full flow is shown in Fig.4. Before the sender initiates the transfer() to transfer their token to the receiver, they interact with TEE (or ZKP) to obtain a signature verifying the correct hash change from 'oldDataHash' to 'newDataHash' through re-encryption with a new key, and a correct sealed key encrypted with the receiver's public key. The sender then interacts with the receiver to obtain a signature confirming access to the data behind the 'newDataHash'. Finally, the sender submits these two signatures to invoke transfer(), and the contract verifies the signatures to update the on-chain state. The receiver can then decrypt the data behind the 'newDataHash' using the key decrypted from the on-chain 'sealedKey' with their private key, completing the transfer of the token with private metadata.

![Full flow](doc/img/full_flow.jpeg)

The clone() process is similar to transfer(), but instead of changing the ownership of the original token, it creates a new token with the same metadata. We also support an authorizeUsage() function that adds authority for using the token's private metadata but not accessing it, requiring a sealed executor that processes the metadata securely. The sealed executor can be implemented using either TEE or FHE.


# 0G Serving Network Provider

## Overview

The 0G Serving Network Provider integrates with the [0G Serving Network Contract](https://github.com/0glabs/0g-serving-contract) and [0G Serving Network User Broker](https://github.com/0glabs/0g-serving-user-broker) to provide a seamless settlement solution for data retrieval services.

## System Architecture

![architecture](./doc/image/architecture.png)

The provider is a crucial component in the overall architecture of the 0G Serving Network (as shown in the diagram above). It is responsible for service registration, settlement operations, and proxying user requests.

The provider is launched as a container group, with four core components:

- **0g-serving-provider-broker**: Handles service registration, settlement, and request proxying operations.
- **0g-serving-provider-event**: Periodically performs fee settlements to ensure user balances are settled before they run out, while controlling settlement frequency to avoid high gas fees.
- **0g-serving-provider-broker-db**: A database that records service registrations, request information, and more.
- **zk-provider-server**: Verifies user requests to ensure they contain valid signatures.

## Documentation

For detailed steps on how to start the provider, please refer to the [0G Compute Network Provider](https://docs.0g.ai/build-with-0g/compute-network/provider) guide.
If you want to interact with an existing provider, please refer to the [0G Compute Network SDK](https://docs.0g.ai/build-with-0g/compute-network/sdk) guide.

## Support and Additional Resources

We want to do everything we can to help you be successful while working on your contribution and projects. Here you'll find various resources and communities that may help you complete a project or contribute to 0G.

### Communities

- [0G Telegram](https://t.me/web3_0glabs)
- [0G Discord](https://discord.com/invite/0glabs)


# 0G Serving Broker Documentation

## Overview

This document provides an overview of the 0G Serving Broker, including setup and usage instructions.

## Setup and Usage

To integrate the 0G Serving Broker into your project, follow these steps

### Step 1: Install the dependency

To get started, you need to install the `@0glabs/0g-serving-broker` package:

```bash
pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0
```

### Step 2: Initialize a Broker Instance

The broker instance is initialized with a `signer`. This signer is an instance that implements the `JsonRpcSigner` or `Wallet` interface from the ethers package and is used to sign transactions for a specific Ethereum account. You can create this instance using your private key via the ethers library or use a wallet framework tool like [wagmi](https://wagmi.sh/react/guides/ethers) to initialize the signer.

```typescript
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
```

### Step 3: List Available Services

```typescript
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
```

### Step 4: Manage Accounts

Before using the provider's services, you need to create an account specifically for the chosen provider. The provider checks the account balance before responding to requests. If the balance is insufficient, the request will be denied.

#### 4.1 Create an Account

```typescript
/**
 * 'addAccount' creates a new account in the contract.
 *
 * @param {number} balance - The initial balance to be assigned to the new account. The unit is A0GI.
 *
 * @throws  An error if the account creation fails.
 */
await broker.ledger.addLedger(balance)
```

#### 4.2 Deposit Funds into the Account

```typescript
/**
 * 'depositFund' deposits a specified amount of funds into an existing account.
 *
 * @param {number} amount - The amount of funds to be deposited. The unit is A0GI.
 *
 * @throws  An error if the deposit fails.
 */
await broker.ledger.depositFund(amount)
```

### Step 5: Use the Provider's Services

#### 5.1 Get Service metadata

```typescript
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
```

### 5.2 Acknowledge Provider
Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

```typescript
/**
 * Acknowledge the given provider address.
 *
 * @param {string} providerAddress - The address of the provider identifying the account.
 * 
 *  @throws Will throw an error if failed to acknowledge.
 */
await broker.inference.acknowledgeProviderSigner(providerAddress)
```


#### 5.3 Get Request Headers

```typescript
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
```

#### 5.4 Send Request

After obtaining the `endpoint`, `model`, and `headers`, you can use client SDKs
compatible with the OpenAI interface to make requests.

**Note**: Fee settlement by the broker service occurs at scheduled intervals.

**Note**: Generated `headers` are valid for a single use only and cannot be reused.

```typescript
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
```

#### 5.5 Process Responses

```typescript
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
```

## Interface

Access the more details of interfaces via cloning the repo and opening [index.html](./docs/index.html) in browser.

# 0G Compute TypeScript SDK Starter Kit

A comprehensive REST API implementation for interacting with the 0G Compute Network using TypeScript. This starter kit demonstrates how to integrate decentralized AI services with automatic payment processing, TEE verification, and seamless wallet management.

## 🌟 Features

- **REST API Server** with Express.js and TypeScript
- **Swagger Documentation** at `/docs` for interactive API testing
- **Official 0G AI Services** with verified provider addresses
- **Automatic Ledger Management** with startup initialization
- **TEE Verification** for enhanced trust and security
- **Single-use Authentication** headers for secure requests
- **Comprehensive Test Script** for learning and debugging
- **BigInt Serialization** for blockchain data compatibility
- **Enhanced Error Handling** with troubleshooting guidance

## 🤖 Official 0G AI Services

The starter kit includes pre-configured access to official 0G AI services:

| Model | Provider Address | Description | Verification |
|-------|-----------------|-------------|-------------|
| **llama-3.3-70b-instruct** | `0xf07240Efa67755B5311bc75784a061eDB47165Dd` | State-of-the-art 70B parameter model for general AI tasks | TEE (TeeML) |
| **deepseek-r1-70b** | `0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3` | Advanced reasoning model optimized for complex problem solving | TEE (TeeML) |

## 📁 Repository Structure

```
0g-compute-starter-kit/
├── src/
│   ├── config/
│   │   └── swagger.ts           # Swagger/OpenAPI configuration
│   ├── controllers/
│   │   ├── accountController.ts # Account management endpoints
│   │   └── serviceController.ts # AI service endpoints
│   ├── routes/
│   │   ├── accountRoutes.ts     # Account route definitions
│   │   └── serviceRoutes.ts     # Service route definitions
│   ├── services/
│   │   └── brokerService.ts     # Core 0G broker integration
│   ├── index.ts                 # Express app entry point
│   └── startup.ts               # Application initialization
├── demo-compute-flow.ts         # Comprehensive demo script
├── DEMO_SCRIPT.md              # Demo script documentation
├── package.json                # Project configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 16+ and npm
2. **Testnet ETH** for transactions ([Get from faucet](https://faucet.0g.ai))
3. **Ethereum wallet** with private key

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/0g-compute-starter-kit.git
cd 0g-compute-starter-kit
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Create .env file
cp .env.example .env  # if available, or create manually
```

Add your configuration to `.env`:
```env
PRIVATE_KEY=your_private_key_here_without_0x_prefix
PORT=4000
NODE_ENV=development
```

4. **Build the project:**
```bash
npm run build
```

5. **Start the server:**
```bash
npm start
```

6. **Access the API:**
- **REST API**: http://localhost:4000
- **Swagger UI**: http://localhost:4000/docs

## 🧪 Run the Complete Flow

Run the comprehensive demo script to see the entire 0G compute workflow:

```bash
npm run demo
```

This script demonstrates:
- Wallet and broker initialization
- Ledger account setup with funding
- Service discovery and provider acknowledgment
- AI query submission with payment processing
- TEE verification and cost tracking

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for detailed documentation.

## 📚 API Endpoints

### Account Management

#### `GET /api/account/info`
Get current account information and ledger balance.

**Response:**
```json
{
  "success": true,
  "accountInfo": {
    "ledgerInfo": ["balance_in_wei"],
    "infers": [],
    "fines": []
  }
}
```

#### `POST /api/account/deposit`
Deposit funds to your ledger account.

**Request:**
```json
{
  "amount": 0.1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deposit successful"
}
```

#### `POST /api/account/refund`
Request refund for unused funds.

**Request:**
```json
{
  "amount": 0.05
}
```

### AI Services

#### `GET /api/services/list`
List all available AI services with pricing and verification status.

**Response:**
```json
{
  "success": true,
  "services": [
    {
      "provider": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
      "model": "llama-3.3-70b-instruct",
      "serviceType": "inference",
      "url": "https://...",
      "inputPrice": "1000000000000000",
      "outputPrice": "2000000000000000",
      "verifiability": "TeeML",
      "isOfficial": true,
      "isVerifiable": true
    }
  ]
}
```

#### `POST /api/services/acknowledge-provider`
Acknowledge a provider before using their services (required once per provider).

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"
}
```

#### `POST /api/services/query`
Send a query to an AI service.

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "query": "What is the capital of France?",
  "fallbackFee": 0.01
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "content": "The capital of France is Paris.",
    "metadata": {
      "model": "llama-3.3-70b-instruct",
      "isValid": true,
      "provider": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
      "chatId": "chatcmpl-..."
    }
  }
}
```

#### `POST /api/services/settle-fee`
Manually settle fees (legacy support for specific error cases).

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "fee": 0.000001
}
```

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run watch        # Start development server with file watching
npm run serve        # Alternative development command

# Production
npm run build        # Compile TypeScript to JavaScript
npm start           # Start production server

# Testing
npm run demo   # Run comprehensive workflow demo
```

## 🏗️ Core Architecture

### Broker Service
The `brokerService` is a singleton that manages all interactions with the 0G Compute Network:

- **Wallet Management**: Automatic wallet initialization with ethers.js
- **Provider Operations**: Service discovery and provider acknowledgment
- **Query Processing**: AI query submission with authentication
- **Payment Handling**: Automatic micropayments and verification
- **Error Management**: Enhanced error messages with troubleshooting

### Application Initialization
On startup, the application automatically:
1. Checks for existing ledger accounts
2. Creates accounts with initial funding if needed (0.01 ETH default)
3. Logs initialization status
4. Starts the Express server

### Authentication Flow
1. **Provider Acknowledgment**: Required once per provider
2. **Header Generation**: Single-use authentication headers per request
3. **Query Submission**: OpenAI-compatible API calls
4. **Response Processing**: TEE verification and payment settlement

## 🔒 Security Best Practices

1. **Environment Variables**: Store private keys securely in `.env`
2. **Input Validation**: All endpoints validate request parameters
3. **Error Sanitization**: Error messages don't expose sensitive data
4. **Single-use Headers**: Authentication headers prevent replay attacks
5. **Network Validation**: RPC endpoint verification

## 🚨 Error Handling

### Common Issues and Solutions

#### Provider Acknowledgment Required
```bash
curl -X POST http://localhost:4000/api/services/acknowledge-provider \
  -H "Content-Type: application/json" \
  -d '{"providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"}'
```

#### Insufficient Balance
```bash
# Check balance
curl http://localhost:4000/api/account/info

# Add funds
curl -X POST http://localhost:4000/api/account/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.1}'
```

#### Provider Not Responding
Get alternative providers:
```bash
curl http://localhost:4000/api/services/list
```

#### Headers Already Used
The system automatically generates new headers for each request. This error indicates a system issue - retry the request.

### Legacy Error: Unsettled Previous Fee

If you encounter:
```
Error: invalid previousOutputFee: expected 0.00000000000000015900000000000001138, got 0
```

Use the settle-fee endpoint with the exact amount:
```json
{
  "providerAddress": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
  "fee": 0.00000000000000015900000000000001138
}
```

## 📋 Example Usage

### Complete Workflow with cURL

1. **Check available services:**
```bash
curl http://localhost:4000/api/services/list
```

2. **Check account balance:**
```bash
curl http://localhost:4000/api/account/info
```

3. **Acknowledge a provider:**
```bash
curl -X POST http://localhost:4000/api/services/acknowledge-provider \
  -H "Content-Type: application/json" \
  -d '{"providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"}'
```

4. **Send a query:**
```bash
curl -X POST http://localhost:4000/api/services/query \
  -H "Content-Type: application/json" \
  -d '{
    "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
    "query": "Explain quantum computing in simple terms",
    "fallbackFee": 0.01
  }'
```

### Integration Example

```typescript
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import OpenAI from 'openai';

// Initialize broker
const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

// Fund account
await broker.ledger.addLedger(0.1);

// Acknowledge provider
const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd';
await broker.inference.acknowledgeProviderSigner(providerAddress);

// Get service info
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress, query);

// Send query
const openai = new OpenAI({ baseURL: endpoint, apiKey: '', defaultHeaders: headers });
const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello, AI!' }],
  model: model,
});

// Process response
const isValid = await broker.inference.processResponse(
  providerAddress,
  completion.choices[0].message.content,
  completion.id
);
```

## 🌐 Network Configuration

- **Testnet RPC**: `https://evmrpc-testnet.0g.ai`
- **Faucet**: https://faucet.0g.ai
- **Chain ID**: 16600 (0G Testnet)

## 📦 Dependencies

### Core Dependencies
- `@0glabs/0g-serving-broker` - 0G Compute Network SDK
- `ethers` - Ethereum wallet and provider functionality
- `openai` - OpenAI-compatible API client
- `express` - Web framework for REST API
- `dotenv` - Environment variable management
- `crypto-js` - Cryptographic utilities

### Development Dependencies
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution for Node.js
- `nodemon` - Development server with hot reload
- `@types/*` - TypeScript type definitions

## 🎯 Use Cases

This starter kit is perfect for:

- **Web Applications** requiring AI integration
- **API Services** with decentralized AI backends
- **Prototyping** AI applications with micropayments
- **Learning** 0G Compute Network integration
- **Testing** different AI models and providers

## 🔄 Branch Structure

### Main Branch (Current)
REST API implementation with Express framework and Swagger documentation.

### CLI Branch
Command-line interface implementation:
```bash
git checkout cli-version
```

## 🛠️ Troubleshooting

### Common Setup Issues

1. **Missing Private Key**: Ensure `PRIVATE_KEY` is set in `.env`
2. **Insufficient ETH**: Get testnet ETH from the faucet
3. **Network Issues**: Check connectivity to 0G testnet
4. **Port Conflicts**: Change `PORT` in `.env` if 4000 is in use

### Performance Tips

1. **Provider Selection**: Use official providers for best reliability
2. **Balance Management**: Maintain sufficient OG tokens for queries
3. **Error Handling**: Implement proper retry logic in production
4. **Rate Limiting**: Consider implementing rate limits for public APIs

## 🔗 Additional Resources

- **0G Compute Documentation**: https://docs.0g.ai/build-with-0g/compute-network
- **SDK Examples**: https://github.com/0glabs/compute-examples
- **Discord Support**: https://discord.gg/0glabs
- **Demo Script Guide**: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Ready to build with decentralized AI? Start with `npm run demo` to see the magic happen!* ✨

# 0G Storage Web App Starter Kit

A modular, well-structured starter kit for building applications that interact with 0G Storage. This project provides a clean architecture for uploading and downloading files using the 0G Storage protocol.

## Features

- File upload to 0G Storage with fee calculation
- File download from 0G Storage using root hash
- Support for both Standard and Turbo network modes
- Wallet integration with connection management
- Modern React UI components with TailwindCSS

## Getting Started

### Prerequisites

- Node.js (v16+)
- Ethereum wallet (e.g., MetaMask)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/0g-storage-starter-kit.git
   cd 0g-storage-starter-kit
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables by creating a `.env.local` file (see Environment Variables section below)

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

The project is organized into a clean, modular architecture:

```
src/
├── app/                   # Next.js app router components
│   ├── providers.tsx      # App providers (Wagmi, Network context)
│   ├── page.tsx           # Main application page
│
├── components/            # React components
│   ├── common/            # Reusable UI components
│   │   ├── FileDropzone.tsx     # Drag-and-drop file selector
│   │   ├── FileInfo.tsx         # File information display
│   │   ├── FeeDisplay.tsx       # Fee calculation display
│   │   ├── TransactionStatus.tsx # Transaction status display
│   │
│   ├── upload/            # Upload-specific components
│   │   ├── UploadCard.tsx    # File upload card
│   │   ├── UploadCardContainer.tsx # Container with remounting logic
│   │
│   ├── download/          # Download-specific components
│   │   ├── DownloadCard.tsx  # File download card
│   │   ├── DownloadCardContainer.tsx # Container with remounting logic
│   │
│   ├── ConnectButton.tsx  # Wallet connection button
│   ├── NetworkToggle.tsx  # Network mode toggle
│
├── hooks/                 # Custom React hooks
│   ├── useWallet.ts       # Wallet connection management
│   ├── useFees.ts         # Fee calculation logic
│   ├── useUpload.ts       # File upload logic
│   ├── useDownload.ts     # File download logic
│
├── lib/                   # Core utilities and SDK
│   ├── 0g/                # 0G Storage SDK utilities
│   │   ├── blob.ts        # Blob creation and handling
│   │   ├── fees.ts        # Fee calculation utilities
│   │   ├── network.ts     # Network configuration
│   │   ├── uploader.ts    # File upload utilities
│   │   ├── downloader.ts  # File download utilities
│
├── utils/                 # Helper functions
│   ├── format.ts          # Formatting utilities
```

## Architecture Overview

This starter kit follows a layered architecture:

### 1. Core SDK/API Layer (`lib/0g/`)

Low-level utilities for interacting with the 0G Storage protocol:

- **blob.ts**: Functions for creating blobs, generating Merkle trees, and root hash calculation
- **fees.ts**: Functions for calculating storage fees and gas estimates
- **network.ts**: Network configuration and management
- **uploader.ts**: Functions for submitting transactions and uploading files
- **downloader.ts**: Functions for downloading files by root hash

### 2. React Hooks Layer (`hooks/`)

Custom hooks that abstract the core functionalities:

- **useWallet.ts**: Manages wallet connection and status, handling hydration safely
- **useFees.ts**: Provides fee calculation for file uploads, creating blobs and Merkle trees
- **useUpload.ts**: Handles the file upload process including transaction submission
- **useDownload.ts**: Manages file downloading by root hash, including error handling

### 3. UI Components Layer (`components/`)

React components for the user interface:

- **Common components**: Reusable UI elements like `FileDropzone`, `FileInfo`, etc.
- **Feature components**: Higher-level components like `UploadCard` and `DownloadCard`

## Usage Examples

### Fee Estimation

To calculate fees for uploading a file:

```jsx
import { useFees } from '@/hooks/useFees';
import { useWallet } from '@/hooks/useWallet';

function MyComponent() {
  const { isConnected } = useWallet();
  const { calculateFeesForFile, feeInfo, error } = useFees();
  
  // When a file is selected
  const handleFileSelect = (file) => {
    // Calculate fees for the file if wallet is connected
    calculateFeesForFile(file, isConnected);
  };
  
  return (
    <div>
      {/* Display fee information */}
      {feeInfo && (
        <div>
          <p>Storage Fee: {feeInfo.storageFee} A0GI</p>
          <p>Estimated Gas: {feeInfo.estimatedGas} A0GI</p>
          <p>Total Fee: {feeInfo.totalFee} A0GI</p>
        </div>
      )}
      
      {/* Display any errors */}
      {error && <p>{error}</p>}
    </div>
  );
}
```

### File Upload

To upload a file to 0G Storage:

```jsx
import { useFees } from '@/hooks/useFees';
import { useUpload } from '@/hooks/useUpload';

function MyUploadComponent() {
  // Get fee calculation hooks
  const { 
    blob, 
    submission, 
    flowContract, 
    feeInfo
  } = useFees();
  
  // Get upload hooks
  const { 
    uploadFile, 
    loading, 
    uploadStatus, 
    txHash, 
    error 
  } = useUpload();
  
  // Handle upload button click
  const handleUpload = async () => {
    if (!blob || !submission || !flowContract || !feeInfo) {
      return; // Missing required data
    }
    
    // Upload the file using the calculated fee
    await uploadFile(
      blob, 
      submission, 
      flowContract, 
      feeInfo.rawTotalFee
    );
  };
  
  return (
    <div>
      <button 
        onClick={handleUpload}
        disabled={loading || !submission}
      >
        Upload File
      </button>
      
      {/* Display upload status */}
      {uploadStatus && <p>{uploadStatus}</p>}
      
      {/* Display transaction hash if available */}
      {txHash && <p>Transaction: {txHash}</p>}
      
      {/* Display any errors */}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

### File Download

To download a file from 0G Storage using a root hash:

```jsx
import { useDownload } from '@/hooks/useDownload';

function MyDownloadComponent() {
  const { 
    downloadFile, 
    loading, 
    downloadStatus, 
    error 
  } = useDownload();
  
  // Handle download action
  const handleDownload = async (rootHash, fileName) => {
    await downloadFile(rootHash, fileName);
  };
  
  return (
    <div>
      <button 
        onClick={() => handleDownload('0x1234...', 'my-file.pdf')}
        disabled={loading}
      >
        Download File
      </button>
      
      {/* Display download status */}
      {downloadStatus && <p>{downloadStatus}</p>}
      
      {/* Display any errors */}
      {error && <p>Error: {error}</p>}
    </div>
  );
}
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
# Project ID for WalletConnect (required)
NEXT_PUBLIC_PROJECT_ID=your_project_id_here

# L1 RPC URL
NEXT_PUBLIC_L1_RPC=https://evmrpc-testnet.0g.ai

# Standard network
NEXT_PUBLIC_STANDARD_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_STANDARD_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_STANDARD_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_STANDARD_L1_RPC=https://evmrpc-testnet.0g.ai

# Turbo network
NEXT_PUBLIC_TURBO_FLOW_ADDRESS=0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628
NEXT_PUBLIC_TURBO_STORAGE_RPC=https://indexer-storage-testnet-turbo.0g.ai
NEXT_PUBLIC_TURBO_EXPLORER_URL=https://chainscan-galileo.0g.ai/tx/
NEXT_PUBLIC_TURBO_L1_RPC=https://evmrpc-testnet.0g.ai

# Default network
NEXT_PUBLIC_DEFAULT_NETWORK=turbo

# 0G Compute / Storage
NEXT_PUBLIC_OG_RPC=https://testnet-rpc.0g.ai
OG_COMPUTE_PRIVATE_KEY=0x...
OG_STORAGE_PRIVATE_KEY=0x...
```

## Advanced Usage

### Working with Network Modes

The application supports two network modes: Standard and Turbo. You can access and change the network mode using the `useNetwork` hook:

```jsx
import { useNetwork } from '@/app/providers';
import { getNetworkConfig } from '@/lib/0g/network';

function MyNetworkComponent() {
  const { networkType, setNetworkType } = useNetwork();
  const networkConfig = getNetworkConfig(networkType);
  
  return (
    <div>
      <p>Current Network: {networkType}</p>
      <p>Flow Address: {networkConfig.flowAddress}</p>
      <button onClick={() => setNetworkType(networkType === 'standard' ? 'turbo' : 'standard')}>
        Toggle Network
      </button>
    </div>
  );
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - s


# 0G Compute TypeScript SDK Starter Kit

A comprehensive REST API implementation for interacting with the 0G Compute Network using TypeScript. This starter kit demonstrates how to integrate decentralized AI services with automatic payment processing, TEE verification, and seamless wallet management.

## 🌟 Features

- **REST API Server** with Express.js and TypeScript
- **Swagger Documentation** at `/docs` for interactive API testing
- **Official 0G AI Services** with verified provider addresses
- **Automatic Ledger Management** with startup initialization
- **TEE Verification** for enhanced trust and security
- **Single-use Authentication** headers for secure requests
- **Comprehensive Test Script** for learning and debugging
- **BigInt Serialization** for blockchain data compatibility
- **Enhanced Error Handling** with troubleshooting guidance

## 🤖 Official 0G AI Services

The starter kit includes pre-configured access to official 0G AI services:

| Model | Provider Address | Description | Verification |
|-------|-----------------|-------------|-------------|
| **llama-3.3-70b-instruct** | `0xf07240Efa67755B5311bc75784a061eDB47165Dd` | State-of-the-art 70B parameter model for general AI tasks | TEE (TeeML) |
| **deepseek-r1-70b** | `0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3` | Advanced reasoning model optimized for complex problem solving | TEE (TeeML) |

## 📁 Repository Structure

```
0g-compute-starter-kit/
├── src/
│   ├── config/
│   │   └── swagger.ts           # Swagger/OpenAPI configuration
│   ├── controllers/
│   │   ├── accountController.ts # Account management endpoints
│   │   └── serviceController.ts # AI service endpoints
│   ├── routes/
│   │   ├── accountRoutes.ts     # Account route definitions
│   │   └── serviceRoutes.ts     # Service route definitions
│   ├── services/
│   │   └── brokerService.ts     # Core 0G broker integration
│   ├── index.ts                 # Express app entry point
│   └── startup.ts               # Application initialization
├── demo-compute-flow.ts         # Comprehensive demo script
├── DEMO_SCRIPT.md              # Demo script documentation
├── package.json                # Project configuration
├── tsconfig.json               # TypeScript configuration
└── README.md                   # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js** 16+ and npm
2. **Testnet ETH** for transactions ([Get from faucet](https://faucet.0g.ai))
3. **Ethereum wallet** with private key

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/0g-compute-starter-kit.git
cd 0g-compute-starter-kit
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
# Create .env file
cp .env.example .env  # if available, or create manually
```

Add your configuration to `.env`:
```env
PRIVATE_KEY=your_private_key_here_without_0x_prefix
PORT=4000
NODE_ENV=development
```

4. **Build the project:**
```bash
npm run build
```

5. **Start the server:**
```bash
npm start
```

6. **Access the API:**
- **REST API**: http://localhost:4000
- **Swagger UI**: http://localhost:4000/docs

## 🧪 Run the Complete Flow

Run the comprehensive demo script to see the entire 0G compute workflow:

```bash
npm run demo
```

This script demonstrates:
- Wallet and broker initialization
- Ledger account setup with funding
- Service discovery and provider acknowledgment
- AI query submission with payment processing
- TEE verification and cost tracking

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for detailed documentation.

## 📚 API Endpoints

### Account Management

#### `GET /api/account/info`
Get current account information and ledger balance.

**Response:**
```json
{
  "success": true,
  "accountInfo": {
    "ledgerInfo": ["balance_in_wei"],
    "infers": [],
    "fines": []
  }
}
```

#### `POST /api/account/deposit`
Deposit funds to your ledger account.

**Request:**
```json
{
  "amount": 0.1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deposit successful"
}
```

#### `POST /api/account/refund`
Request refund for unused funds.

**Request:**
```json
{
  "amount": 0.05
}
```

### AI Services

#### `GET /api/services/list`
List all available AI services with pricing and verification status.

**Response:**
```json
{
  "success": true,
  "services": [
    {
      "provider": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
      "model": "llama-3.3-70b-instruct",
      "serviceType": "inference",
      "url": "https://...",
      "inputPrice": "1000000000000000",
      "outputPrice": "2000000000000000",
      "verifiability": "TeeML",
      "isOfficial": true,
      "isVerifiable": true
    }
  ]
}
```

#### `POST /api/services/acknowledge-provider`
Acknowledge a provider before using their services (required once per provider).

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"
}
```

#### `POST /api/services/query`
Send a query to an AI service.

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "query": "What is the capital of France?",
  "fallbackFee": 0.01
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "content": "The capital of France is Paris.",
    "metadata": {
      "model": "llama-3.3-70b-instruct",
      "isValid": true,
      "provider": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
      "chatId": "chatcmpl-..."
    }
  }
}
```

#### `POST /api/services/settle-fee`
Manually settle fees (legacy support for specific error cases).

**Request:**
```json
{
  "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
  "fee": 0.000001
}
```

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run watch        # Start development server with file watching
npm run serve        # Alternative development command

# Production
npm run build        # Compile TypeScript to JavaScript
npm start           # Start production server

# Testing
npm run demo   # Run comprehensive workflow demo
```

## 🏗️ Core Architecture

### Broker Service
The `brokerService` is a singleton that manages all interactions with the 0G Compute Network:

- **Wallet Management**: Automatic wallet initialization with ethers.js
- **Provider Operations**: Service discovery and provider acknowledgment
- **Query Processing**: AI query submission with authentication
- **Payment Handling**: Automatic micropayments and verification
- **Error Management**: Enhanced error messages with troubleshooting

### Application Initialization
On startup, the application automatically:
1. Checks for existing ledger accounts
2. Creates accounts with initial funding if needed (0.01 ETH default)
3. Logs initialization status
4. Starts the Express server

### Authentication Flow
1. **Provider Acknowledgment**: Required once per provider
2. **Header Generation**: Single-use authentication headers per request
3. **Query Submission**: OpenAI-compatible API calls
4. **Response Processing**: TEE verification and payment settlement

## 🔒 Security Best Practices

1. **Environment Variables**: Store private keys securely in `.env`
2. **Input Validation**: All endpoints validate request parameters
3. **Error Sanitization**: Error messages don't expose sensitive data
4. **Single-use Headers**: Authentication headers prevent replay attacks
5. **Network Validation**: RPC endpoint verification

## 🚨 Error Handling

### Common Issues and Solutions

#### Provider Acknowledgment Required
```bash
curl -X POST http://localhost:4000/api/services/acknowledge-provider \
  -H "Content-Type: application/json" \
  -d '{"providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"}'
```

#### Insufficient Balance
```bash
# Check balance
curl http://localhost:4000/api/account/info

# Add funds
curl -X POST http://localhost:4000/api/account/deposit \
  -H "Content-Type: application/json" \
  -d '{"amount": 0.1}'
```

#### Provider Not Responding
Get alternative providers:
```bash
curl http://localhost:4000/api/services/list
```

#### Headers Already Used
The system automatically generates new headers for each request. This error indicates a system issue - retry the request.

### Legacy Error: Unsettled Previous Fee

If you encounter:
```
Error: invalid previousOutputFee: expected 0.00000000000000015900000000000001138, got 0
```

Use the settle-fee endpoint with the exact amount:
```json
{
  "providerAddress": "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3",
  "fee": 0.00000000000000015900000000000001138
}
```

## 📋 Example Usage

### Complete Workflow with cURL

1. **Check available services:**
```bash
curl http://localhost:4000/api/services/list
```

2. **Check account balance:**
```bash
curl http://localhost:4000/api/account/info
```

3. **Acknowledge a provider:**
```bash
curl -X POST http://localhost:4000/api/services/acknowledge-provider \
  -H "Content-Type: application/json" \
  -d '{"providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd"}'
```

4. **Send a query:**
```bash
curl -X POST http://localhost:4000/api/services/query \
  -H "Content-Type: application/json" \
  -d '{
    "providerAddress": "0xf07240Efa67755B5311bc75784a061eDB47165Dd",
    "query": "Explain quantum computing in simple terms",
    "fallbackFee": 0.01
  }'
```

### Integration Example

```typescript
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
import OpenAI from 'openai';

// Initialize broker
const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

// Fund account
await broker.ledger.addLedger(0.1);

// Acknowledge provider
const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd';
await broker.inference.acknowledgeProviderSigner(providerAddress);

// Get service info
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress, query);

// Send query
const openai = new OpenAI({ baseURL: endpoint, apiKey: '', defaultHeaders: headers });
const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello, AI!' }],
  model: model,
});

// Process response
const isValid = await broker.inference.processResponse(
  providerAddress,
  completion.choices[0].message.content,
  completion.id
);
```

## 🌐 Network Configuration

- **Testnet RPC**: `https://evmrpc-testnet.0g.ai`
- **Faucet**: https://faucet.0g.ai
- **Chain ID**: 16600 (0G Testnet)

## 📦 Dependencies

### Core Dependencies
- `@0glabs/0g-serving-broker` - 0G Compute Network SDK
- `ethers` - Ethereum wallet and provider functionality
- `openai` - OpenAI-compatible API client
- `express` - Web framework for REST API
- `dotenv` - Environment variable management
- `crypto-js` - Cryptographic utilities

### Development Dependencies
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution for Node.js
- `nodemon` - Development server with hot reload
- `@types/*` - TypeScript type definitions

## 🎯 Use Cases

This starter kit is perfect for:

- **Web Applications** requiring AI integration
- **API Services** with decentralized AI backends
- **Prototyping** AI applications with micropayments
- **Learning** 0G Compute Network integration
- **Testing** different AI models and providers

## 🔄 Branch Structure

### Main Branch (Current)
REST API implementation with Express framework and Swagger documentation.

### CLI Branch
Command-line interface implementation:
```bash
git checkout cli-version
```

## 🛠️ Troubleshooting

### Common Setup Issues

1. **Missing Private Key**: Ensure `PRIVATE_KEY` is set in `.env`
2. **Insufficient ETH**: Get testnet ETH from the faucet
3. **Network Issues**: Check connectivity to 0G testnet
4. **Port Conflicts**: Change `PORT` in `.env` if 4000 is in use

### Performance Tips

1. **Provider Selection**: Use official providers for best reliability
2. **Balance Management**: Maintain sufficient OG tokens for queries
3. **Error Handling**: Implement proper retry logic in production
4. **Rate Limiting**: Consider implementing rate limits for public APIs

## 🔗 Additional Resources

- **0G Compute Documentation**: https://docs.0g.ai/build-with-0g/compute-network
- **SDK Examples**: https://github.com/0glabs/compute-examples
- **Discord Support**: https://discord.gg/0glabs
- **Demo Script Guide**: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Ready to build with decentralized AI? Start with `npm run demo` to see the magic happen!* ✨

# 0g-ts-sdk

This is the JavaScript SDK for 0g-storage. Features include:

- [x] File Merkle Tree Class
- [x] Flow Contract Types
- [x] RPC methods support
- [x] File upload
- [x] Support browser environment
- [ ] Tests for different environments
- [x] File download

## Install

```sh
npm install @0glabs/0g-ts-sdk ethers
```

`ethers` is a peer dependency of this project.

## Usage

### Node.js environment ESM example:

Use `ZgFile` to create a file object, then call `merkleTree` method to get the merkle tree of the file.

```js
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
```

Upload file to 0g-storage:

```js
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
```

Download file from 0g-storage

```js
err = await indexer.download(<root_hash>, <output_file>, <with_proof>);
if (err !== null) {
  console.log("Error downloading file: ", err);
}
```

Upload data to 0g-kv:

```js
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
```

Download data from 0g-kv
```js
const KvClientAddr = "http://3.101.147.150:6789"

const streamId = "0x..."
const kvClient = new KvClient(KvClientAddr)

let val = await kvClient.getValue(streamId, ethers.encodeBase64(key1));
console.log(val)
```

### Browser environment example:

Import `zgstorage.esm.js` in your html file:

```html
<script type="module">
  import { Blob, Indexer } from "./dist/zgstorage.esm.js";
  // Your code here...
</script>
```

Create file object from blob:

```js
const file = new Blob(blob);
const [tree, err] = await file.merkleTree();
if (err === null) {
  console.log("File Root Hash: ", tree.rootHash());
}
```

File upload is same with node.js environment with the following provider change

```js
import { BrowserProvider } from 'ethers';  // or from ethers.js url

let provider = new BrowserProvider(window.ethereum) // metamask need to be installed
```


### Vite example:

To use the SDK with Vite, set up polyfills in your `vite.config.ts`:

```ts
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
```

Now, you can import SDK files with the `/browser` suffix:

```ts
import { Indexer, Blob } from '@0glabs/0g-ts-sdk/browser';
```

Check codes in [examples](./examples) for more details.

## Contribute

This project uses [pnpm](https://pnpm.js.org/) as package manager. After cloning the project, run `pnpm install` to install dependencies.

### Generate Contract Flow Types

Make sure [0g-storage-contracts](https://github.com/0glabs/0g-storage-contracts) is in project sibling directory.

```sh
pnpm gen-contract-type-flow
pnpm gen-contract-type-market
```


# 0G Serving Broker Documentation

## Overview

This document provides an overview of the 0G Serving Broker, including setup and usage instructions.

## Setup and Usage

To integrate the 0G Serving Broker into your project, follow these steps

### Step 1: Install the dependency

To get started, you need to install the `@0glabs/0g-serving-broker` package:

```bash
pnpm add @0glabs/0g-serving-broker @types/crypto-js@4.2.2 crypto-js@4.2.0
```

### Step 2: Initialize a Broker Instance

The broker instance is initialized with a `signer`. This signer is an instance that implements the `JsonRpcSigner` or `Wallet` interface from the ethers package and is used to sign transactions for a specific Ethereum account. You can create this instance using your private key via the ethers library or use a wallet framework tool like [wagmi](https://wagmi.sh/react/guides/ethers) to initialize the signer.

```typescript
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
```

### Step 3: List Available Services

```typescript
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
```

### Step 4: Manage Accounts

Before using the provider's services, you need to create an account specifically for the chosen provider. The provider checks the account balance before responding to requests. If the balance is insufficient, the request will be denied.

#### 4.1 Create an Account

```typescript
/**
 * 'addAccount' creates a new account in the contract.
 *
 * @param {number} balance - The initial balance to be assigned to the new account. The unit is A0GI.
 *
 * @throws  An error if the account creation fails.
 */
await broker.ledger.addLedger(balance)
```

#### 4.2 Deposit Funds into the Account

```typescript
/**
 * 'depositFund' deposits a specified amount of funds into an existing account.
 *
 * @param {number} amount - The amount of funds to be deposited. The unit is A0GI.
 *
 * @throws  An error if the deposit fails.
 */
await broker.ledger.depositFund(amount)
```

### Step 5: Use the Provider's Services

#### 5.1 Get Service metadata

```typescript
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
```

### 5.2 Acknowledge Provider
Before using a service provided by a provider, you must first acknowledge the provider on-chain by following API:

```typescript
/**
 * Acknowledge the given provider address.
 *
 * @param {string} providerAddress - The address of the provider identifying the account.
 * 
 *  @throws Will throw an error if failed to acknowledge.
 */
await broker.inference.acknowledgeProviderSigner(providerAddress)
```


#### 5.3 Get Request Headers

```typescript
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
```

#### 5.4 Send Request

After obtaining the `endpoint`, `model`, and `headers`, you can use client SDKs
compatible with the OpenAI interface to make requests.

**Note**: Fee settlement by the broker service occurs at scheduled intervals.

**Note**: Generated `headers` are valid for a single use only and cannot be reused.

```typescript
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
```

#### 5.5 Process Responses

```typescript
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
```

## Interface

Access the more details of interfaces via cloning the repo and opening [index.html](./docs/index.html) in browser.

\n## Fine-tune via 0G Compute Network
Run `pnpm e2e:fine-tune` to verify the end-to-end fine-tuning flow. The script uploads a tiny dataset, starts a training task via the new broker and polls until the model is delivered and finished.
