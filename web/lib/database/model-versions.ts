// lib/database/model-versions.ts
/**
 * Database service for managing AI model versions
 * Handles the lifecycle: candidate -> active -> archived
 */

export interface ModelVersion {
  id: number
  agentId: number
  modelRootHash: string
  status: 'candidate' | 'active' | 'archived'
  datasetRootHash: string
  pretrainedHash: string
  trainingParamsHash: string
  taskId: string
  metricsJson?: any
  logRootHash?: string
  createdAt: Date
  activatedAt?: Date
  archivedAt?: Date
  providerAddress: string
  userAddress: string
}

export interface ConsentRecord {
  id: number
  agentId: number
  userAddress: string
  consentType: string
  payloadJson: any
  signature: string
  signatureHash: string
  createdAt: Date
}

/**
 * In-memory database implementation for development/testing
 * In production, this would connect to PostgreSQL/MySQL
 */
class InMemoryModelVersionDB {
  private modelVersions: Map<number, ModelVersion> = new Map()
  private consents: Map<number, ConsentRecord> = new Map()
  private nextId = 1
  private nextConsentId = 1

  async createModelVersion(data: Omit<ModelVersion, 'id' | 'createdAt'>): Promise<ModelVersion> {
    const modelVersion: ModelVersion = {
      ...data,
      id: this.nextId++,
      createdAt: new Date()
    }
    
    this.modelVersions.set(modelVersion.id, modelVersion)
    return modelVersion
  }

  async getModelVersionsByAgent(agentId: number): Promise<ModelVersion[]> {
    return Array.from(this.modelVersions.values())
      .filter(mv => mv.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async getActiveModelVersion(agentId: number): Promise<ModelVersion | null> {
    return Array.from(this.modelVersions.values())
      .find(mv => mv.agentId === agentId && mv.status === 'active') || null
  }

  async getCandidateModelVersions(agentId: number): Promise<ModelVersion[]> {
    return Array.from(this.modelVersions.values())
      .filter(mv => mv.agentId === agentId && mv.status === 'candidate')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  async getModelVersionByRootHash(rootHash: string): Promise<ModelVersion | null> {
    return Array.from(this.modelVersions.values())
      .find(mv => mv.modelRootHash === rootHash) || null
  }

  async getModelVersionByTaskId(taskId: string): Promise<ModelVersion | null> {
    return Array.from(this.modelVersions.values())
      .find(mv => mv.taskId === taskId) || null
  }

  async updateModelVersionStatus(
    id: number, 
    status: 'candidate' | 'active' | 'archived',
    timestamp?: Date
  ): Promise<ModelVersion | null> {
    const modelVersion = this.modelVersions.get(id)
    if (!modelVersion) return null

    modelVersion.status = status
    
    if (status === 'active') {
      modelVersion.activatedAt = timestamp || new Date()
      // Deactivate other active models for this agent
      Array.from(this.modelVersions.values())
        .filter(mv => mv.agentId === modelVersion.agentId && mv.id !== id && mv.status === 'active')
        .forEach(mv => {
          mv.status = 'archived'
          mv.archivedAt = timestamp || new Date()
        })
    } else if (status === 'archived') {
      modelVersion.archivedAt = timestamp || new Date()
    }

    return modelVersion
  }

  async activateModelVersion(agentId: number, modelRootHash: string): Promise<ModelVersion | null> {
    const modelVersion = Array.from(this.modelVersions.values())
      .find(mv => mv.agentId === agentId && mv.modelRootHash === modelRootHash)
    
    if (!modelVersion) return null

    return this.updateModelVersionStatus(modelVersion.id, 'active')
  }

  async recordConsent(data: Omit<ConsentRecord, 'id' | 'createdAt'>): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      ...data,
      id: this.nextConsentId++,
      createdAt: new Date()
    }
    
    this.consents.set(consent.id, consent)
    return consent
  }

  async getConsentsByAgent(agentId: number): Promise<ConsentRecord[]> {
    return Array.from(this.consents.values())
      .filter(c => c.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  // Development helpers
  async getAllModelVersions(): Promise<ModelVersion[]> {
    return Array.from(this.modelVersions.values())
  }

  async clear(): Promise<void> {
    this.modelVersions.clear()
    this.consents.clear()
    this.nextId = 1
    this.nextConsentId = 1
  }
}

// Singleton instance
const db = new InMemoryModelVersionDB()

export class ModelVersionService {
  
  /**
   * Create a new model version when training is delivered
   */
  static async createModelVersion(params: {
    agentId: number
    modelRootHash: string
    datasetRootHash: string
    pretrainedHash: string
    trainingParamsHash: string
    taskId: string
    providerAddress: string
    userAddress: string
    metricsJson?: any
    logRootHash?: string
  }): Promise<ModelVersion> {
    return db.createModelVersion({
      ...params,
      status: 'candidate' // All new models start as candidates
    })
  }

  /**
   * Get all model versions for an agent
   */
  static async getAgentModelVersions(agentId: number): Promise<ModelVersion[]> {
    return db.getModelVersionsByAgent(agentId)
  }

  /**
   * Get the currently active model for an agent
   */
  static async getActiveModel(agentId: number): Promise<ModelVersion | null> {
    return db.getActiveModelVersion(agentId)
  }

  /**
   * Get candidate models (delivered but not active) for an agent
   */
  static async getCandidateModels(agentId: number): Promise<ModelVersion[]> {
    return db.getCandidateModelVersions(agentId)
  }

  /**
   * Activate a model version (make it the active model for the agent)
   */
  static async activateModel(agentId: number, modelRootHash: string): Promise<ModelVersion | null> {
    return db.activateModelVersion(agentId, modelRootHash)
  }

  /**
   * Get model version by root hash
   */
  static async getModelByRootHash(rootHash: string): Promise<ModelVersion | null> {
    return db.getModelVersionByRootHash(rootHash)
  }

  /**
   * Get model version by task ID
   */
  static async getModelByTaskId(taskId: string): Promise<ModelVersion | null> {
    return db.getModelVersionByTaskId(taskId)
  }

  /**
   * Record user consent for fine-tuning operations
   */
  static async recordConsent(params: {
    agentId: number
    userAddress: string
    consentType: 'fineTune' | 'activate' | 'other'
    payloadJson: any
    signature: string
    signatureHash: string
  }): Promise<ConsentRecord> {
    return db.recordConsent(params)
  }

  /**
   * Get consent records for an agent
   */
  static async getConsentHistory(agentId: number): Promise<ConsentRecord[]> {
    return db.getConsentsByAgent(agentId)
  }

  /**
   * Get model version statistics for an agent
   */
  static async getModelStats(agentId: number): Promise<{
    total: number
    active: number
    candidates: number
    archived: number
    latestModelDate?: Date
  }> {
    const versions = await db.getModelVersionsByAgent(agentId)
    
    return {
      total: versions.length,
      active: versions.filter(v => v.status === 'active').length,
      candidates: versions.filter(v => v.status === 'candidate').length,
      archived: versions.filter(v => v.status === 'archived').length,
      latestModelDate: versions.length > 0 ? versions[0].createdAt : undefined
    }
  }

  // Development helpers
  static async clearDatabase(): Promise<void> {
    return db.clear()
  }

  static async getAllModels(): Promise<ModelVersion[]> {
    return db.getAllModelVersions()
  }
}