// lib/contracts/agent-model-registry.ts
/**
 * Service for interacting with the AgentModelRegistry smart contract
 * Handles on-chain attestation and transparency
 */

import { ethers } from 'ethers'
import { AGENT_MODEL_REGISTRY_ABI } from './abis'

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'

export interface TaskCreatedEvent {
  tokenId: number
  user: string
  provider: string
  datasetRoot: string
  pretrainedHash: string
  trainingParamsHash: string
  taskId: string
  timestamp: number
  transactionHash: string
}

export interface ModelDeliveredEvent {
  tokenId: number
  user: string
  provider: string
  modelRoot: string
  metricsHash?: string
  logRoot?: string
  taskId: string
  timestamp: number
  transactionHash: string
}

export interface ModelActivatedEvent {
  tokenId: number
  modelRoot: string
  activatedBy: string
  timestamp: number
  transactionHash: string
}

export interface ModelVersionInfo {
  modelRoot: string
  taskId: string
  createdAt: number
  isActive: boolean
  metricsHash: string
  logRoot: string
}

export interface TaskInfo {
  tokenId: number
  user: string
  provider: string
  datasetRoot: string
  pretrainedHash: string
  trainingParamsHash: string
  createdAt: number
  delivered: boolean
  modelRoot: string
  deliveredAt: number
}

export class AgentModelRegistryService {
  private contract: ethers.Contract
  private signer: ethers.Wallet | ethers.JsonRpcSigner
  private provider: ethers.Provider

  constructor(
    contractAddress: string,
    signerOrProvider: ethers.Wallet | ethers.JsonRpcSigner | ethers.Provider,
    rpcUrl?: string
  ) {
    if ('signTransaction' in signerOrProvider) {
      // It's a signer
      this.signer = signerOrProvider as ethers.Wallet | ethers.JsonRpcSigner
      this.provider = this.signer.provider!
      this.contract = new ethers.Contract(contractAddress, AGENT_MODEL_REGISTRY_ABI, this.signer)
    } else {
      // It's a provider
      this.provider = signerOrProvider as ethers.Provider
      this.contract = new ethers.Contract(contractAddress, AGENT_MODEL_REGISTRY_ABI, this.provider)
    }
  }

  /**
   * Attest that a training task has been created (platform service key only)
   */
  async attestTask(params: {
    tokenId: number
    user: string
    provider: string
    datasetRoot: string
    pretrainedHash: string
    trainingParamsHash: string
    taskId: string
  }): Promise<{ txHash: string; event: TaskCreatedEvent }> {
    if (!this.signer) {
      throw new Error('Signer required for attestTask')
    }

    const tx = await this.contract.attestTask(
      params.tokenId,
      params.user,
      params.provider,
      params.datasetRoot,
      params.pretrainedHash,
      params.trainingParamsHash,
      params.taskId
    )

    const receipt = await tx.wait()
    
    // Find the TaskCreated event
    const taskCreatedEvent = receipt.events?.find(
      (e: any) => e.event === 'TaskCreated'
    )

    if (!taskCreatedEvent) {
      throw new Error('TaskCreated event not found in transaction receipt')
    }

    return {
      txHash: receipt.transactionHash,
      event: {
        tokenId: taskCreatedEvent.args.tokenId.toNumber(),
        user: taskCreatedEvent.args.user,
        provider: taskCreatedEvent.args.provider,
        datasetRoot: taskCreatedEvent.args.datasetRoot,
        pretrainedHash: taskCreatedEvent.args.pretrainedHash,
        trainingParamsHash: taskCreatedEvent.args.trainingParamsHash,
        taskId: taskCreatedEvent.args.taskId,
        timestamp: taskCreatedEvent.args.timestamp.toNumber(),
        transactionHash: receipt.transactionHash
      }
    }
  }

  /**
   * Attest that a model has been delivered (platform service key only)
   */
  async attestDelivery(params: {
    taskId: string
    modelRoot: string
    metricsHash?: string
    logRoot?: string
  }): Promise<{ txHash: string; event: ModelDeliveredEvent }> {
    if (!this.signer) {
      throw new Error('Signer required for attestDelivery')
    }

    const tx = await this.contract.attestDelivery(
      params.taskId,
      params.modelRoot,
      params.metricsHash || ethers.constants.HashZero,
      params.logRoot || ethers.constants.HashZero
    )

    const receipt = await tx.wait()
    
    // Find the ModelDelivered event
    const modelDeliveredEvent = receipt.events?.find(
      (e: any) => e.event === 'ModelDelivered'
    )

    if (!modelDeliveredEvent) {
      throw new Error('ModelDelivered event not found in transaction receipt')
    }

    return {
      txHash: receipt.transactionHash,
      event: {
        tokenId: modelDeliveredEvent.args.tokenId.toNumber(),
        user: modelDeliveredEvent.args.user,
        provider: modelDeliveredEvent.args.provider,
        modelRoot: modelDeliveredEvent.args.modelRoot,
        metricsHash: modelDeliveredEvent.args.metricsHash !== ethers.constants.HashZero 
          ? modelDeliveredEvent.args.metricsHash : undefined,
        logRoot: modelDeliveredEvent.args.logRoot !== ethers.constants.HashZero 
          ? modelDeliveredEvent.args.logRoot : undefined,
        taskId: modelDeliveredEvent.args.taskId,
        timestamp: modelDeliveredEvent.args.timestamp.toNumber(),
        transactionHash: receipt.transactionHash
      }
    }
  }

  /**
   * Set active model for a token (platform service key only)
   */
  async setActiveModel(
    tokenId: number,
    modelRoot: string
  ): Promise<{ txHash: string; event: ModelActivatedEvent }> {
    if (!this.signer) {
      throw new Error('Signer required for setActiveModel')
    }

    const tx = await this.contract.setActiveModel(tokenId, modelRoot)
    const receipt = await tx.wait()
    
    // Find the ModelActivated event
    const modelActivatedEvent = receipt.events?.find(
      (e: any) => e.event === 'ModelActivated'
    )

    if (!modelActivatedEvent) {
      throw new Error('ModelActivated event not found in transaction receipt')
    }

    return {
      txHash: receipt.transactionHash,
      event: {
        tokenId: modelActivatedEvent.args.tokenId.toNumber(),
        modelRoot: modelActivatedEvent.args.modelRoot,
        activatedBy: modelActivatedEvent.args.activatedBy,
        timestamp: modelActivatedEvent.args.timestamp.toNumber(),
        transactionHash: receipt.transactionHash
      }
    }
  }

  /**
   * Record user consent (platform service key only)
   */
  async recordConsent(params: {
    tokenId: number
    user: string
    consentType: string
    signatureHash: string
  }): Promise<string> {
    if (!this.signer) {
      throw new Error('Signer required for recordConsent')
    }

    const tx = await this.contract.recordConsent(
      params.tokenId,
      params.user,
      params.consentType,
      params.signatureHash
    )

    const receipt = await tx.wait()
    return receipt.transactionHash
  }

  // View functions (read-only, no signer required)

  /**
   * Get active model for a token
   */
  async getActiveModel(tokenId: number): Promise<string> {
    const modelRoot = await this.contract.activeModelOf(tokenId)
    return modelRoot === ethers.constants.HashZero ? '' : modelRoot
  }

  /**
   * Get task information
   */
  async getTask(taskId: string): Promise<TaskInfo | null> {
    try {
      const task = await this.contract.getTask(taskId)
      
      // Check if task exists (createdAt > 0)
      if (task.createdAt.eq(0)) {
        return null
      }

      return {
        tokenId: task.tokenId.toNumber(),
        user: task.user,
        provider: task.provider,
        datasetRoot: task.datasetRoot,
        pretrainedHash: task.pretrainedHash,
        trainingParamsHash: task.trainingParamsHash,
        createdAt: task.createdAt.toNumber(),
        delivered: task.delivered,
        modelRoot: task.modelRoot === ethers.constants.HashZero ? '' : task.modelRoot,
        deliveredAt: task.deliveredAt.toNumber()
      }
    } catch (error) {
      console.error('Error getting task:', error)
      return null
    }
  }

  /**
   * Get all model versions for a token
   */
  async getModelVersions(tokenId: number): Promise<ModelVersionInfo[]> {
    try {
      const versions = await this.contract.getModelVersions(tokenId)
      
      return versions.map((version: any) => ({
        modelRoot: version.modelRoot,
        taskId: version.taskId,
        createdAt: version.createdAt.toNumber(),
        isActive: version.isActive,
        metricsHash: version.metricsHash === ethers.constants.HashZero ? '' : version.metricsHash,
        logRoot: version.logRoot === ethers.constants.HashZero ? '' : version.logRoot
      }))
    } catch (error) {
      console.error('Error getting model versions:', error)
      return []
    }
  }

  /**
   * Get candidate models (delivered but not active) for a token
   */
  async getCandidateModels(tokenId: number): Promise<ModelVersionInfo[]> {
    try {
      const candidates = await this.contract.getCandidateModels(tokenId)
      
      return candidates.map((candidate: any) => ({
        modelRoot: candidate.modelRoot,
        taskId: candidate.taskId,
        createdAt: candidate.createdAt.toNumber(),
        isActive: candidate.isActive,
        metricsHash: candidate.metricsHash === ethers.constants.HashZero ? '' : candidate.metricsHash,
        logRoot: candidate.logRoot === ethers.constants.HashZero ? '' : candidate.logRoot
      }))
    } catch (error) {
      console.error('Error getting candidate models:', error)
      return []
    }
  }

  /**
   * Check if a model has been attested
   */
  async isModelAttested(modelRoot: string): Promise<boolean> {
    try {
      return await this.contract.isModelAttested(modelRoot)
    } catch (error) {
      console.error('Error checking model attestation:', error)
      return false
    }
  }

  // Event helpers

  /**
   * Get block explorer URL for a transaction
   */
  getExplorerUrl(txHash: string): string {
    const explorerUrl = process.env.NEXT_PUBLIC_STANDARD_EXPLORER_URL || 'https://chainscan-galileo.0g.ai/tx/'
    return `${explorerUrl}${txHash}`
  }

  /**
   * Listen for events from the contract
   */
  onTaskCreated(callback: (event: TaskCreatedEvent) => void): void {
    this.contract.on('TaskCreated', (tokenId, user, provider, datasetRoot, pretrainedHash, trainingParamsHash, taskId, timestamp, event) => {
      callback({
        tokenId: tokenId.toNumber(),
        user,
        provider,
        datasetRoot,
        pretrainedHash,
        trainingParamsHash,
        taskId,
        timestamp: timestamp.toNumber(),
        transactionHash: event.transactionHash
      })
    })
  }

  onModelDelivered(callback: (event: ModelDeliveredEvent) => void): void {
    this.contract.on('ModelDelivered', (tokenId, user, provider, modelRoot, metricsHash, logRoot, taskId, timestamp, event) => {
      callback({
        tokenId: tokenId.toNumber(),
        user,
        provider,
        modelRoot,
        metricsHash: metricsHash !== ethers.constants.HashZero ? metricsHash : undefined,
        logRoot: logRoot !== ethers.constants.HashZero ? logRoot : undefined,
        taskId,
        timestamp: timestamp.toNumber(),
        transactionHash: event.transactionHash
      })
    })
  }

  onModelActivated(callback: (event: ModelActivatedEvent) => void): void {
    this.contract.on('ModelActivated', (tokenId, modelRoot, activatedBy, timestamp, event) => {
      callback({
        tokenId: tokenId.toNumber(),
        modelRoot,
        activatedBy,
        timestamp: timestamp.toNumber(),
        transactionHash: event.transactionHash
      })
    })
  }

  /**
   * Stop listening to events
   */
  removeAllListeners(): void {
    this.contract.removeAllListeners()
  }
}

/**
 * Create a registry service instance for the platform service key
 */
export function createRegistryService(contractAddress: string, privateKey: string, rpcUrl: string): AgentModelRegistryService {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer = new ethers.Wallet(privateKey, provider)
  return new AgentModelRegistryService(contractAddress, signer)
}

/**
 * Create a read-only registry service instance for public queries
 */
export function createRegistryServiceReadOnly(contractAddress: string, rpcUrl: string): AgentModelRegistryService {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  return new AgentModelRegistryService(contractAddress, provider)
}