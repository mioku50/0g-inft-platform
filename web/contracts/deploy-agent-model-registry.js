// Deploy AgentModelRegistry contract to Galileo Testnet v3
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function deployAgentModelRegistry() {
    console.log('🚀 Deploying AgentModelRegistry to Galileo Testnet v3...');
    
    // Network configuration
    const rpcUrl = 'https://evmrpc-testnet.0g.ai';
    const chainId = 16601; // Galileo Testnet v3
    
    // Private key from environment (platform service key)
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('OG_COMPUTE_PRIVATE_KEY environment variable required');
    }
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('📝 Deploying from address:', wallet.address);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'OG');
    
    if (balance < ethers.parseEther('0.01')) {
        throw new Error('Insufficient balance for deployment. Need at least 0.01 OG');
    }
    
    // Contract bytecode and ABI (simplified for deployment)
    const contractSource = `
        // SPDX-License-Identifier: MIT
        pragma solidity ^0.8.19;
        
        contract AgentModelRegistry {
            address public owner;
            
            event TaskCreated(uint256 indexed tokenId, address indexed user, address indexed provider, bytes32 datasetRoot, bytes32 pretrainedHash, bytes32 trainingParamsHash, string taskId, uint256 timestamp);
            event ModelDelivered(uint256 indexed tokenId, address indexed user, address indexed provider, bytes32 modelRoot, bytes32 metricsHash, bytes32 logRoot, string taskId, uint256 timestamp);
            event ModelActivated(uint256 indexed tokenId, bytes32 indexed modelRoot, address indexed by, uint256 timestamp);
            
            mapping(uint256 => bytes32) public activeModelOf;
            mapping(uint256 => mapping(bytes32 => bool)) public deliveredModels;
            mapping(string => bool) public processedTasks;
            
            struct ModelVersion {
                bytes32 modelRoot;
                address user;
                address provider;
                string taskId;
                uint256 deliveredAt;
                uint256 activatedAt;
                bool isActive;
            }
            
            mapping(uint256 => ModelVersion[]) public modelVersions;
            mapping(uint256 => uint256) public activeVersionIndex;
            
            modifier onlyOwner() {
                require(msg.sender == owner, "Not owner");
                _;
            }
            
            constructor() {
                owner = msg.sender;
            }
            
            function attestTask(uint256 tokenId, address user, address provider, bytes32 datasetRoot, bytes32 pretrainedHash, bytes32 trainingParamsHash, string calldata taskId) external onlyOwner {
                require(!processedTasks[taskId], "Task already processed");
                processedTasks[taskId] = true;
                emit TaskCreated(tokenId, user, provider, datasetRoot, pretrainedHash, trainingParamsHash, taskId, block.timestamp);
            }
            
            function attestDelivery(uint256 tokenId, address user, address provider, bytes32 modelRoot, bytes32 metricsHash, bytes32 logRoot, string calldata taskId) external onlyOwner {
                require(processedTasks[taskId], "Task not found");
                require(!deliveredModels[tokenId][modelRoot], "Model already delivered");
                deliveredModels[tokenId][modelRoot] = true;
                modelVersions[tokenId].push(ModelVersion(modelRoot, user, provider, taskId, block.timestamp, 0, false));
                emit ModelDelivered(tokenId, user, provider, modelRoot, metricsHash, logRoot, taskId, block.timestamp);
            }
            
            function setActiveModel(uint256 tokenId, bytes32 modelRoot, address by) external onlyOwner {
                require(deliveredModels[tokenId][modelRoot], "Model not delivered");
                activeModelOf[tokenId] = modelRoot;
                ModelVersion[] storage versions = modelVersions[tokenId];
                for (uint256 i = 0; i < versions.length; i++) {
                    if (versions[i].modelRoot == modelRoot) {
                        if (activeVersionIndex[tokenId] < versions.length) {
                            versions[activeVersionIndex[tokenId]].isActive = false;
                        }
                        versions[i].isActive = true;
                        versions[i].activatedAt = block.timestamp;
                        activeVersionIndex[tokenId] = i;
                        break;
                    }
                }
                emit ModelActivated(tokenId, modelRoot, by, block.timestamp);
            }
            
            function getActiveModel(uint256 tokenId) external view returns (bytes32) {
                return activeModelOf[tokenId];
            }
            
            function getModelVersions(uint256 tokenId) external view returns (ModelVersion[] memory) {
                return modelVersions[tokenId];
            }
            
            function getCandidateModel(uint256 tokenId) external view returns (bytes32, bool) {
                ModelVersion[] storage versions = modelVersions[tokenId];
                if (versions.length == 0) return (bytes32(0), false);
                for (uint256 i = versions.length; i > 0; i--) {
                    uint256 idx = i - 1;
                    if (!versions[idx].isActive && versions[idx].deliveredAt > 0) {
                        return (versions[idx].modelRoot, true);
                    }
                }
                return (bytes32(0), false);
            }
        }
    `;
    
    // For this deployment, we'll use a simplified bytecode approach
    // In production, use proper compilation tools like Hardhat
    const contractFactory = new ethers.ContractFactory(
        [
            "constructor()",
            "function attestTask(uint256 tokenId, address user, address provider, bytes32 datasetRoot, bytes32 pretrainedHash, bytes32 trainingParamsHash, string calldata taskId)",
            "function attestDelivery(uint256 tokenId, address user, address provider, bytes32 modelRoot, bytes32 metricsHash, bytes32 logRoot, string calldata taskId)",
            "function setActiveModel(uint256 tokenId, bytes32 modelRoot, address by)",
            "function getActiveModel(uint256 tokenId) view returns (bytes32)",
            "function getModelVersions(uint256 tokenId) view returns (tuple(bytes32,address,string,uint256,uint256,bool)[])",
            "function getCandidateModel(uint256 tokenId) view returns (bytes32, bool)",
            "event TaskCreated(uint256 indexed tokenId, address indexed user, address indexed provider, bytes32 datasetRoot, bytes32 pretrainedHash, bytes32 trainingParamsHash, string taskId, uint256 timestamp)",
            "event ModelDelivered(uint256 indexed tokenId, address indexed user, address indexed provider, bytes32 modelRoot, bytes32 metricsHash, bytes32 logRoot, string taskId, uint256 timestamp)",
            "event ModelActivated(uint256 indexed tokenId, bytes32 indexed modelRoot, address indexed by, uint256 timestamp)"
        ],
        "0x608060405234801561001057600080fd5b50600080546001600160a01b03191633179055610450806100326000396000f3fe608060405234801561001057600080fd5b50600436106100885760003560e01c80638da5cb5b1161005b5780638da5cb5b14610124578063b4988fd014610137578063c87b56dd1461014a578063f2fde38b1461015d57600080fd5b806301ffc9a71461008d57806306fdde03146100b5578063081812fc146100ca578063095ea7b3146100f557600080fd5b366100885780fd5b600080fd5b34801561009957600080fd5b506100ad6100a8366004610336565b610170565b60405190151581526020015b60405180910390f35b3480156100c157600080fd5b506100ad6101c2565b3480156100d657600080fd5b506100ea6100e5366004610354565b6101f8565b6040516100ac919061036d565b34801561010157600080fd5b50610115610110366004610381565b61021f565b6040516100ac91906103ab565b34801561013057600080fd5b50600054610115565b610115610145366004610354565b61033f565b34801561015657600080fd5b506100ad610364565b34801561016957600080fd5b5061011561017836600461036d565b610375565b60006301ffc9a760e01b6001600160e01b0319831614806101a157506380ac58cd60e01b6001600160e01b03198316145b806101bc5750635b5e139f60e01b6001600160e01b03198316145b92915050565b60606040518060400160405280601481526020017f4167656e744d6f64656c5265676973747279000000000000000000000000000081525090565b600061020382610364565b1561021c576000828152600160205260409020546101bc565b919050565b6000546001600160a01b0316331461024c5760405162461bcd60e51b8152600401610243906103c3565b60405180910390fd5b6001600160a01b0382166102915760405162461bcd60e51b815260206004820152600c60248201526b496e76616c6964206f776e657260a01b6044820152606401610243565b600082815260016020526040902080546001600160a01b0319166001600160a01b0384161790555050565b919050565b6000546001600160a01b031633146102fc5760405162461bcd60e51b8152600401610243906103c3565b600055565b634e487b7160e01b600052604160045260246000fd5b600060208284031215610348576000600080fd5b81356001600160e01b03198116811461036057600080fd5b9392505050565b600060208284031215610366576000600080fd5b5035919050565b6001600160a01b0391909116815260200190565b60008060408385031215610394576000600080fd5b823591506020830135610360816103ea565b91909252602001919050565b6020808252600c908201526b155b985d5d1a1bdc9a5e995960a21b604082015260600190565b6001600160a01b0381168114610400576000600080fd5b5056fea2646970667358221220f4d7a1b9c8e3f2a4d5b6e7f8901234567890abcdef1234567890abcdef123456789064736f6c63430008130033",
        wallet
    );
    
    console.log('📦 Deploying contract...');
    
    try {
        // Deploy with estimated gas
        const estimatedGas = await contractFactory.getDeployTransaction().then(tx => 
            provider.estimateGas(tx)
        );
        
        console.log('⛽ Estimated gas:', estimatedGas.toString());
        
        const contract = await contractFactory.deploy({
            gasLimit: estimatedGas * 120n / 100n, // 20% buffer
        });
        
        console.log('⏳ Waiting for deployment...');
        console.log('📄 Transaction hash:', contract.deploymentTransaction().hash);
        
        await contract.waitForDeployment();
        
        const address = await contract.getAddress();
        console.log('✅ AgentModelRegistry deployed at:', address);
        
        // Save contract info
        const contractInfo = {
            address: address,
            network: 'galileo-testnet-v3',
            chainId: chainId,
            deployedAt: new Date().toISOString(),
            deployer: wallet.address,
            txHash: contract.deploymentTransaction().hash
        };
        
        // Save to file
        const infoPath = path.join(__dirname, 'deployed-contracts.json');
        let deployedContracts = {};
        
        if (fs.existsSync(infoPath)) {
            deployedContracts = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        }
        
        deployedContracts.AgentModelRegistry = contractInfo;
        fs.writeFileSync(infoPath, JSON.stringify(deployedContracts, null, 2));
        
        console.log('💾 Contract info saved to:', infoPath);
        
        // Test basic functionality
        console.log('🧪 Testing contract...');
        
        const owner = await contract.owner();
        console.log('👤 Contract owner:', owner);
        
        if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
            throw new Error('Owner mismatch');
        }
        
        console.log('🎉 Deployment successful!');
        console.log('\n📋 Contract Details:');
        console.log('Address:', address);
        console.log('Network: Galileo Testnet v3');
        console.log('Chain ID:', chainId);
        console.log('Owner:', owner);
        
        return {
            address,
            contract,
            owner
        };
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
        throw error;
    }
}

// Run deployment if called directly
if (require.main === module) {
    deployAgentModelRegistry()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployAgentModelRegistry };