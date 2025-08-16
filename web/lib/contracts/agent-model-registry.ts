// lib/contracts/agent-model-registry.ts
// Integration with AgentModelRegistry smart contract

import { ethers } from 'ethers';
import AgentModelRegistryABI from '@/contracts/AgentModelRegistry.abi.json';
import { 
  getRateLimitedProvider, 
  createRateLimitedWallet, 
  createRateLimitedContract,
  safeContractCall 
} from '@/lib/server/rate-limited-provider';

// Contract configuration for Galileo Testnet v3
const AGENT_MODEL_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AGENT_MODEL_REGISTRY_ADDRESS || 
  process.env.AGENT_MODEL_REGISTRY_ADDRESS ||
  '0x358d481AbFE7548EA8F3a806c675729910F29E4e'; // Default from .env.local

const PLATFORM_PRIVATE_KEY = process.env.OG_COMPUTE_PRIVATE_KEY;

// Allow the module to load without private key for read-only operations
let platformSigner: any = null;
let registryContract: any = null;

function getContract() {
  if (!registryContract) {
    if (!PLATFORM_PRIVATE_KEY) {
      // For read-only operations, create contract without signer
      const provider = getRateLimitedProvider();
      registryContract = createRateLimitedContract(
        AGENT_MODEL_REGISTRY_ADDRESS,
        AgentModelRegistryABI,
        provider
      );
    } else {
      // For write operations, create with signer
      platformSigner = createRateLimitedWallet(PLATFORM_PRIVATE_KEY);
      registryContract = createRateLimitedContract(
        AGENT_MODEL_REGISTRY_ADDRESS,
        AgentModelRegistryABI,
        platformSigner
      );
    }
  }
  return registryContract;
}

/**
 * Platform service for interacting with AgentModelRegistry
 * All methods are called by the platform on behalf of users
 */
export class AgentModelRegistryService {
  
  /**
   * Attest the creation of a fine-tuning task on-chain
   * Platform pays gas for this transaction
   */
  static async attestTask(
    tokenId: number,
    userAddress: string,
    providerAddress: string,
    datasetRoot: string,
    pretrainedHash: string,
    trainingParamsHash: string,
    taskId: string
  ): Promise<string> {
    try {
      console.log(`🔗 Attesting task creation for agent ${tokenId}...`);
      
      // Validate inputs
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address');
      }
      if (!ethers.isAddress(providerAddress)) {
        throw new Error('Invalid provider address');
      }
      
      // Convert strings to bytes32 if needed
      const datasetRootBytes32 = datasetRoot.startsWith('0x') ? datasetRoot : ethers.keccak256(ethers.toUtf8Bytes(datasetRoot));
      const pretrainedHashBytes32 = pretrainedHash.startsWith('0x') ? pretrainedHash : ethers.keccak256(ethers.toUtf8Bytes(pretrainedHash));
      const trainingParamsHashBytes32 = trainingParamsHash.startsWith('0x') ? trainingParamsHash : ethers.keccak256(ethers.toUtf8Bytes(trainingParamsHash));
      
      // Call contract method (platform pays gas)
      const contract = getContract()
      if (!PLATFORM_PRIVATE_KEY) {
        throw new Error('OG_COMPUTE_PRIVATE_KEY required for write operations')
      }
      const tx = await contract.attestTask(
        tokenId,
        userAddress,
        providerAddress,
        datasetRootBytes32,
        pretrainedHashBytes32,
        trainingParamsHashBytes32,
        taskId
      );
      
      console.log(`📄 TaskCreated transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Task attested successfully in block ${receipt.blockNumber}`);
      
      return tx.hash;
      
    } catch (error: any) {
      console.error('Failed to attest task:', error);
      throw new Error(`Task attestation failed: ${error.message}`);
    }
  }

  /**
   * Attest the delivery of a trained model on-chain
   * Platform pays gas for this transaction
   */
  static async attestDelivery(
    tokenId: number,
    userAddress: string,
    providerAddress: string,
    modelRoot: string,
    metricsHash: string,
    logRoot: string,
    taskId: string
  ): Promise<string> {
    try {
      console.log(`🔗 Attesting model delivery for agent ${tokenId}...`);
      
      // Validate inputs
      if (!ethers.isAddress(userAddress)) {
        throw new Error('Invalid user address');
      }
      if (!ethers.isAddress(providerAddress)) {
        throw new Error('Invalid provider address');
      }
      
      // Convert strings to bytes32 if needed
      const modelRootBytes32 = modelRoot.startsWith('0x') ? modelRoot : ethers.keccak256(ethers.toUtf8Bytes(modelRoot));
      const metricsHashBytes32 = metricsHash.startsWith('0x') ? metricsHash : ethers.keccak256(ethers.toUtf8Bytes(metricsHash));
      const logRootBytes32 = logRoot.startsWith('0x') ? logRoot : ethers.keccak256(ethers.toUtf8Bytes(logRoot));
      
      // Call contract method (platform pays gas)
      const contract = getContract()
      if (!PLATFORM_PRIVATE_KEY) {
        throw new Error('OG_COMPUTE_PRIVATE_KEY required for write operations')
      }
      const tx = await contract.attestDelivery(
        tokenId,
        userAddress,
        providerAddress,
        modelRootBytes32,
        metricsHashBytes32,
        logRootBytes32,
        taskId
      );
      
      console.log(`📄 ModelDelivered transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Model delivery attested successfully in block ${receipt.blockNumber}`);
      
      return tx.hash;
      
    } catch (error: any) {
      console.error('Failed to attest delivery:', error);
      throw new Error(`Delivery attestation failed: ${error.message}`);
    }
  }

  /**
   * Set active model for an agent on-chain
   * Platform pays gas for this transaction
   */
  static async setActiveModel(
    tokenId: number,
    modelRoot: string,
    byAddress: string
  ): Promise<string> {
    try {
      console.log(`🔗 Setting active model for agent ${tokenId}...`);
      
      // Validate inputs
      if (!ethers.isAddress(byAddress)) {
        throw new Error('Invalid address');
      }
      
      // Convert string to bytes32 if needed
      const modelRootBytes32 = modelRoot.startsWith('0x') ? modelRoot : ethers.keccak256(ethers.toUtf8Bytes(modelRoot));
      
      // Call contract method (platform pays gas)
      const contract = getContract()
      if (!PLATFORM_PRIVATE_KEY) {
        throw new Error('OG_COMPUTE_PRIVATE_KEY required for write operations')
      }
      const tx = await contract.setActiveModel(
        tokenId,
        modelRootBytes32,
        byAddress
      );
      
      console.log(`📄 ModelActivated transaction sent: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Model activated successfully in block ${receipt.blockNumber}`);
      
      return tx.hash;
      
    } catch (error: any) {
      console.error('Failed to set active model:', error);
      throw new Error(`Model activation failed: ${error.message}`);
    }
  }

  /**
   * Get active model for an agent with safe error handling
   */
  static async getActiveModel(tokenId: number): Promise<string> {
    try {
      console.log(`[registry] Getting active model for token ${tokenId}...`)
      
      const contract = getContract()
      
      // Use ethers v6 staticCall syntax
      const model = await contract.getActiveModel.staticCall(tokenId)
      
      console.log(`[registry] Active model for token ${tokenId}:`, model)
      return model
      
    } catch (error: any) {
      console.log(`[registry] getActiveModel(${tokenId}) failed (this is normal if no model is set):`, error.message)
      
      // Revert means no active model is assigned - this is not an error
      if (error.message.includes('execution reverted') || error.message.includes('require(false)')) {
        console.log(`[registry] No active model set for token ${tokenId} - returning default`)
        return '0x0000000000000000000000000000000000000000000000000000000000000000'
      }
      
      // Other errors should be logged but not crash the app
      console.warn(`[registry] Unexpected error in getActiveModel(${tokenId}):`, error.message)
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    }
  }

  /**
   * Get candidate model for an agent with safe error handling
   * Uses ethers v6 staticCall syntax and properly handles revert as "no model"
   */
  static async getCandidateModel(tokenId: number): Promise<{ modelRoot: string; hasCandidate: boolean }> {
    try {
      console.log(`[registry] Getting candidate model for token ${tokenId}...`)
      
      const contract = getContract()
      
      // Use ethers v6 staticCall syntax
      const [modelRoot, hasCandidate] = await contract.getCandidateModel.staticCall(tokenId)
      
      console.log(`[registry] Candidate model for token ${tokenId}:`, { modelRoot, hasCandidate })
      return { modelRoot, hasCandidate }
      
    } catch (error: any) {
      console.log(`[registry] getCandidateModel(${tokenId}) failed (this is normal if no model is set):`, error.message)
      
      // Revert means no candidate model is assigned - this is not an error
      if (error.message.includes('execution reverted') || error.message.includes('require(false)')) {
        console.log(`[registry] No candidate model set for token ${tokenId} - returning default`)
        return {
          modelRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
          hasCandidate: false
        }
      }
      
      // Other errors should be logged but not crash the app
      console.warn(`[registry] Unexpected error in getCandidateModel(${tokenId}):`, error.message)
      return {
        modelRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        hasCandidate: false
      }
    }
  }

  /**
   * Get all model versions for an agent with safe error handling
   */
  static async getModelVersions(tokenId: number): Promise<any[]> {
    try {
      const contract = getContract()
      return await contract.getModelVersions.staticCall(tokenId)
    } catch (error: any) {
      console.warn(`getModelVersions(${tokenId}) failed:`, error.message)
      return []
    }
  }

  /**
   * Check if a model was delivered for an agent with safe error handling
   */
  static async isModelDelivered(tokenId: number, modelRoot: string): Promise<boolean> {
    try {
      const contract = getContract()
      const modelRootBytes32 = modelRoot.startsWith('0x') ? modelRoot : ethers.keccak256(ethers.toUtf8Bytes(modelRoot))
      return await contract.isModelDelivered.staticCall(tokenId, modelRootBytes32)
    } catch (error: any) {
      console.warn(`isModelDelivered(${tokenId}, ${modelRoot.slice(0, 10)}...) failed:`, error.message)
      return false
    }
  }

  /**
   * Check if a task was processed with safe error handling
   */
  static async isTaskProcessed(taskId: string): Promise<boolean> {
    try {
      const contract = getContract()
      return await contract.isTaskProcessed.staticCall(taskId)
    } catch (error: any) {
      console.warn(`isTaskProcessed(${taskId}) failed:`, error.message)
      return false
    }
  }

  /**
   * Generate chain link for viewing transaction
   */
  static getChainLink(txHash: string): string {
    return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
  }

  /**
   * Get contract address for frontend
   */
  static getContractAddress(): string {
    return AGENT_MODEL_REGISTRY_ADDRESS;
  }

  /**
   * Validate contract deployment with safe error handling
   */
  static async validateContract(): Promise<boolean> {
    try {
      if (AGENT_MODEL_REGISTRY_ADDRESS === '0x0000000000000000000000000000000000000000') {
        console.warn('⚠️  AgentModelRegistry contract address not configured');
        return false;
      }
      
      // Try to get owner with safe fallback
      let owner = null
      try {
        const contract = getContract()
        owner = await contract.owner?.staticCall?.()
      } catch (error: any) {
        console.warn('Contract owner() call failed:', error.message)
      }
      
      if (!owner) {
        console.warn('⚠️  Contract owner() method not available or failed');
        return true; // Allow operation but warn
      }
      
      const expectedOwner = platformSigner?.address || 'unknown';
      
      if (typeof owner === 'string' && owner.toLowerCase() !== expectedOwner.toLowerCase()) {
        console.error(`❌ Contract owner mismatch. Expected: ${expectedOwner}, Got: ${owner}`);
        return false;
      }
      
      console.log('✅ AgentModelRegistry contract validated');
      return true;
      
    } catch (error: any) {
      console.error('Failed to validate contract:', error);
      return false;
    }
  }
}

// Utility function to calculate hashes
export function calculateTrainingParamsHash(params: any): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(params)));
}

export function calculateMetricsHash(metrics: any): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metrics)));
}

export default AgentModelRegistryService;