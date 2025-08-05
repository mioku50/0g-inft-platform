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

const PLATFORM_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY;

let platformSigner: any = null;
let registryContract: any = null;

if (!PLATFORM_PRIVATE_KEY) {
  console.warn('⚠️  OG_STORAGE_PRIVATE_KEY not configured - Agent Model Registry operations will be limited');
} else {
  // Rate-limited provider and signer for platform operations
  platformSigner = createRateLimitedWallet(PLATFORM_PRIVATE_KEY);
  
  // Rate-limited contract instance
  registryContract = createRateLimitedContract(
    AGENT_MODEL_REGISTRY_ADDRESS,
    AgentModelRegistryABI,
    platformSigner
  );
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
      const tx = await registryContract?.attestTask(
        tokenId,
        userAddress,
        providerAddress,
        datasetRootBytes32,
        pretrainedHashBytes32,
        trainingParamsHashBytes32,
        taskId
      );
      
      console.log(`📄 TaskCreated transaction sent: ${tx?.hash}`);
      
      // Wait for confirmation
      const receipt = await tx?.wait();
      
      if (receipt?.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Task attested successfully in block ${receipt?.blockNumber}`);
      
      return tx?.hash || '';
      
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
      const tx = await registryContract?.attestDelivery(
        tokenId,
        userAddress,
        providerAddress,
        modelRootBytes32,
        metricsHashBytes32,
        logRootBytes32,
        taskId
      );
      
      console.log(`📄 ModelDelivered transaction sent: ${tx?.hash}`);
      
      // Wait for confirmation
      const receipt = await tx?.wait();
      
      if (receipt?.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Model delivery attested successfully in block ${receipt?.blockNumber}`);
      
      return tx?.hash || '';
      
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
      const tx = await registryContract?.setActiveModel(
        tokenId,
        modelRootBytes32,
        byAddress
      );
      
      console.log(`📄 ModelActivated transaction sent: ${tx?.hash}`);
      
      // Wait for confirmation
      const receipt = await tx?.wait();
      
      if (receipt?.status !== 1) {
        throw new Error('Transaction failed');
      }
      
      console.log(`✅ Model activated successfully in block ${receipt?.blockNumber}`);
      
      return tx?.hash || '';
      
    } catch (error: any) {
      console.error('Failed to set active model:', error);
      throw new Error(`Model activation failed: ${error.message}`);
    }
  }

  /**
   * Get active model for an agent with safe error handling
   */
  static async getActiveModel(tokenId: number): Promise<string> {
    return safeContractCall(
      () => registryContract?.getActiveModel(tokenId),
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      `getActiveModel(${tokenId})`
    )
  }

  /**
   * Get candidate model for an agent with safe error handling
   */
  static async getCandidateModel(tokenId: number): Promise<{ modelRoot: string; hasCandidate: boolean }> {
    return safeContractCall(
      async () => {
        const [modelRoot, hasCandidate] = await registryContract?.getCandidateModel(tokenId)
        return { modelRoot, hasCandidate }
      },
      {
        modelRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
        hasCandidate: false
      },
      `getCandidateModel(${tokenId})`
    )
  }

  /**
   * Get all model versions for an agent with safe error handling
   */
  static async getModelVersions(tokenId: number): Promise<any[]> {
    return safeContractCall(
      () => registryContract?.getModelVersions(tokenId),
      [],
      `getModelVersions(${tokenId})`
    )
  }

  /**
   * Check if a model was delivered for an agent with safe error handling
   */
  static async isModelDelivered(tokenId: number, modelRoot: string): Promise<boolean> {
    return safeContractCall(
      () => {
        const modelRootBytes32 = modelRoot.startsWith('0x') ? modelRoot : ethers.keccak256(ethers.toUtf8Bytes(modelRoot))
        return registryContract?.isModelDelivered(tokenId, modelRootBytes32)
      },
      false,
      `isModelDelivered(${tokenId}, ${modelRoot.slice(0, 10)}...)`
    )
  }

  /**
   * Check if a task was processed with safe error handling
   */
  static async isTaskProcessed(taskId: string): Promise<boolean> {
    return safeContractCall(
      () => registryContract?.isTaskProcessed(taskId),
      false,
      `isTaskProcessed(${taskId})`
    )
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
      const owner = await safeContractCall(
        () => registryContract?.owner?.(),
        null,
        'contract.owner()'
      )
      
      if (!owner || typeof owner !== 'string') {
        console.warn('⚠️  Contract owner() method not available or failed');
        return true; // Allow operation but warn
      }
      
      if (!platformSigner) {
        console.warn('⚠️  Platform signer not available for contract validation');
        return true; // Allow operation but warn
      }
      
      const expectedOwner = platformSigner.address;
      const ownerString = owner as string; // Type assertion after validation
      
      if (ownerString.toLowerCase() !== expectedOwner.toLowerCase()) {
        console.error(`❌ Contract owner mismatch. Expected: ${expectedOwner}, Got: ${ownerString}`);
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

// Event listeners for real-time updates (optional)
export class AgentModelRegistryEvents {
  
  static setupEventListeners() {
    // Listen for TaskCreated events
    registryContract?.on('TaskCreated', (
      tokenId: bigint,
      user: string,
      provider: string,
      datasetRoot: string,
      pretrainedHash: string,
      trainingParamsHash: string,
      taskId: string,
      timestamp: bigint
    ) => {
      console.log(`🎉 TaskCreated event: Agent ${tokenId.toString()}, Task ${taskId}`);
      // Emit to frontend via WebSocket/SSE if needed
    });

    // Listen for ModelDelivered events
    registryContract?.on('ModelDelivered', (
      tokenId: bigint,
      user: string,
      provider: string,
      modelRoot: string,
      metricsHash: string,
      logRoot: string,
      taskId: string,
      timestamp: bigint
    ) => {
      console.log(`🎉 ModelDelivered event: Agent ${tokenId.toString()}, Task ${taskId}`);
      // Update database and notify frontend
    });

    // Listen for ModelActivated events
    registryContract?.on('ModelActivated', (
      tokenId: bigint,
      modelRoot: string,
      by: string,
      timestamp: bigint
    ) => {
      console.log(`🎉 ModelActivated event: Agent ${tokenId.toString()}`);
      // Update database and notify frontend
    });
  }

  static removeEventListeners() {
    registryContract?.removeAllListeners();
  }
}

export default AgentModelRegistryService;