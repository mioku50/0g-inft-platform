// database/connection.ts
// Database connection utility for Fine-tuning System

import fs from 'fs';
import path from 'path';

// Simple in-memory database for MVP
// In production, use PostgreSQL, MySQL, or SQLite
export interface ModelVersion {
  id: number;
  agentId: number;
  modelRootHash: string;
  status: 'candidate' | 'active' | 'archived';
  datasetRootHash: string;
  pretrainedHash: string;
  trainingParamsHash: string;
  metricsJson?: string;
  logRoot?: string;
  providerAddress: string;
  taskId: string;
  txHashCreated?: string;
  txHashDelivered?: string;
  txHashActivated?: string;
  createdAt: Date;
  deliveredAt?: Date;
  activatedAt?: Date;
  archivedAt?: Date;
  updatedAt?: Date;
}

export interface TrainingTask {
  id: number;
  taskId: string;
  agentId: number;
  userAddress: string;
  providerAddress: string;
  modelId: string;
  datasetRootHash: string;
  trainingParamsHash: string;
  status: string;
  progressMessage?: string;
  modelRootHash?: string;
  errorMessage?: string;
  txHashAttested?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
}

export interface Consent {
  id: number;
  agentId: number;
  userAddress: string;
  consentType: 'fineTune' | 'activate';
  payloadJson: string;
  signature: string;
  signatureHash: string;
  createdAt: Date;
}

// In-memory storage for MVP (replace with real DB in production)
class InMemoryDatabase {
  private modelVersions: ModelVersion[] = [];
  private trainingTasks: TrainingTask[] = [];
  private consents: Consent[] = [];
  private nextId = 1;
  private dataFile: string;

  constructor() {
    this.dataFile = path.join(process.cwd(), 'database', 'data.json');
    this.loadData();
  }

  private loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
        this.modelVersions = data.modelVersions || [];
        this.trainingTasks = data.trainingTasks || [];
        this.consents = data.consents || [];
        this.nextId = data.nextId || 1;
        
        // Convert date strings back to Date objects
        this.modelVersions.forEach(v => {
          v.createdAt = new Date(v.createdAt);
          if (v.deliveredAt) v.deliveredAt = new Date(v.deliveredAt);
          if (v.activatedAt) v.activatedAt = new Date(v.activatedAt);
          if (v.archivedAt) v.archivedAt = new Date(v.archivedAt);
        });
        
        this.trainingTasks.forEach(t => {
          t.createdAt = new Date(t.createdAt);
          t.updatedAt = new Date(t.updatedAt);
          if (t.deliveredAt) t.deliveredAt = new Date(t.deliveredAt);
        });
        
        this.consents.forEach(c => {
          c.createdAt = new Date(c.createdAt);
        });
      }
    } catch (error) {
      console.warn('Failed to load database data:', error);
    }
  }

  private saveData() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        modelVersions: this.modelVersions,
        trainingTasks: this.trainingTasks,
        consents: this.consents,
        nextId: this.nextId
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save database data:', error);
    }
  }

  // Model Version operations
  async createModelVersion(version: Omit<ModelVersion, 'id' | 'createdAt'>): Promise<ModelVersion> {
    const newVersion: ModelVersion = {
      id: this.nextId++,
      createdAt: new Date(),
      ...version
    };
    
    this.modelVersions.push(newVersion);
    this.saveData();
    return newVersion;
  }

  async getModelVersionsByAgent(agentId: number): Promise<ModelVersion[]> {
    return this.modelVersions.filter(v => v.agentId === agentId);
  }

  async getActiveModelVersion(agentId: number): Promise<ModelVersion | null> {
    return this.modelVersions.find(v => v.agentId === agentId && v.status === 'active') || null;
  }

  async getCandidateModelVersions(agentId: number): Promise<ModelVersion[]> {
    return this.modelVersions.filter(v => v.agentId === agentId && v.status === 'candidate');
  }

  async updateModelVersionStatus(
    id: number, 
    status: ModelVersion['status'], 
    txHash?: string
  ): Promise<ModelVersion | null> {
    const version = this.modelVersions.find(v => v.id === id);
    if (!version) return null;

    version.status = status;
    version.updatedAt = new Date();
    
    if (status === 'active') {
      version.activatedAt = new Date();
      if (txHash) version.txHashActivated = txHash;
      
      // Archive previous active version
      this.modelVersions.forEach(v => {
        if (v.agentId === version.agentId && v.id !== id && v.status === 'active') {
          v.status = 'archived';
          v.archivedAt = new Date();
        }
      });
    } else if (status === 'archived') {
      version.archivedAt = new Date();
    }

    this.saveData();
    return version;
  }

  async getModelVersionByHash(modelRootHash: string): Promise<ModelVersion | null> {
    return this.modelVersions.find(v => v.modelRootHash === modelRootHash) || null;
  }

  // Training Task operations
  async createTrainingTask(task: Omit<TrainingTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<TrainingTask> {
    const newTask: TrainingTask = {
      id: this.nextId++,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...task
    };
    
    this.trainingTasks.push(newTask);
    this.saveData();
    return newTask;
  }

  async getTrainingTaskById(taskId: string): Promise<TrainingTask | null> {
    return this.trainingTasks.find(t => t.taskId === taskId) || null;
  }

  async getTrainingTasksByAgent(agentId: number): Promise<TrainingTask[]> {
    return this.trainingTasks.filter(t => t.agentId === agentId).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async updateTrainingTask(
    taskId: string, 
    updates: Partial<Pick<TrainingTask, 'status' | 'progressMessage' | 'modelRootHash' | 'errorMessage' | 'txHashAttested' | 'deliveredAt'>>
  ): Promise<TrainingTask | null> {
    const task = this.trainingTasks.find(t => t.taskId === taskId);
    if (!task) return null;

    Object.assign(task, updates);
    task.updatedAt = new Date();
    
    if (updates.deliveredAt) {
      task.deliveredAt = updates.deliveredAt;
    }

    this.saveData();
    return task;
  }

  // Consent operations
  async createConsent(consent: Omit<Consent, 'id' | 'createdAt'>): Promise<Consent> {
    const newConsent: Consent = {
      id: this.nextId++,
      createdAt: new Date(),
      ...consent
    };
    
    this.consents.push(newConsent);
    this.saveData();
    return newConsent;
  }

  async getConsentsByAgent(agentId: number): Promise<Consent[]> {
    return this.consents.filter(c => c.agentId === agentId);
  }

  // Agent model summary
  async getAgentModelSummary(agentId: number) {
    const versions = await this.getModelVersionsByAgent(agentId);
    const activeVersion = versions.find(v => v.status === 'active');
    const candidateVersions = versions.filter(v => v.status === 'candidate');
    const latestCandidate = candidateVersions.sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    return {
      agentId,
      totalVersions: versions.length,
      activeModel: activeVersion ? {
        modelRootHash: activeVersion.modelRootHash,
        activatedAt: activeVersion.activatedAt,
        txHash: activeVersion.txHashActivated
      } : null,
      candidateModel: latestCandidate ? {
        modelRootHash: latestCandidate.modelRootHash,
        deliveredAt: latestCandidate.deliveredAt,
        txHash: latestCandidate.txHashDelivered
      } : null,
      hasCandidate: candidateVersions.length > 0,
      versions: versions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    };
  }
}

// Singleton instance
const db = new InMemoryDatabase();

export { db };

// Utility functions for common operations
export async function addDeliveredModel(
  agentId: number,
  modelRootHash: string,
  datasetRootHash: string,
  pretrainedHash: string,
  trainingParamsHash: string,
  providerAddress: string,
  taskId: string,
  txHash: string,
  metricsJson?: string,
  logRoot?: string
): Promise<ModelVersion> {
  return await db.createModelVersion({
    agentId,
    modelRootHash,
    status: 'candidate',
    datasetRootHash,
    pretrainedHash,
    trainingParamsHash,
    providerAddress,
    taskId,
    txHashDelivered: txHash,
    metricsJson,
    logRoot,
    deliveredAt: new Date()
  });
}

export async function activateModelVersion(
  agentId: number,
  modelRootHash: string,
  txHash: string
): Promise<ModelVersion | null> {
  const version = await db.getModelVersionByHash(modelRootHash);
  if (!version || version.agentId !== agentId) {
    return null;
  }
  
  return await db.updateModelVersionStatus(version.id, 'active', txHash);
}

export async function getAgentActiveModel(agentId: number): Promise<string | null> {
  const activeVersion = await db.getActiveModelVersion(agentId);
  return activeVersion?.modelRootHash || null;
}

export async function getAgentCandidateModel(agentId: number): Promise<{ modelRootHash: string; hasCandidate: boolean }> {
  const candidates = await db.getCandidateModelVersions(agentId);
  const latest = candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  
  return {
    modelRootHash: latest?.modelRootHash || '',
    hasCandidate: !!latest
  };
}