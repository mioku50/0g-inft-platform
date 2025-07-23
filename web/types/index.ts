// types/index.ts

// Agent related types
export interface AgentMetadata {
  name: string
  description: string
  model: string
  capabilities: string[]
  parameters?: Record<string, any>
  image?: string
  version?: string
  createdAt?: number
}

export interface Agent {
  tokenId: string
  owner: string
  metadata: AgentMetadata
  encryptedURI: string
  metadataHash: string
  isListed?: boolean
  listingPrice?: bigint
}

// Chat related types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    tokens?: number
    functionCall?: any
  }
}

export interface ChatSession {
  agentId: string
  messages: ChatMessage[]
  createdAt: Date
  lastMessageAt: Date
}

// Marketplace types
export interface MarketplaceListing {
  tokenId: string
  seller: string
  price: bigint
  isActive: boolean
  listedAt: Date
  description?: string
  views?: number
  likes?: number
}

export interface MarketplaceStats {
  totalListed: number
  totalVolume: bigint
  averagePrice: bigint
  topAgents: Agent[]
}

// Storage types
export interface StorageUploadResult {
  uri: string
  encryptionKey: string
  storageId: string
  metadataHash: string
}

export interface StorageMetadata {
  owner: string
  timestamp: number
  encrypted: boolean
  version: string
}

// Compute types
export interface ComputeRequest {
  tokenId: string
  action: 'chat' | 'execute' | 'analyze'
  params: Record<string, any>
  context?: any
}

export interface ComputeResponse {
  result: any
  usage?: {
    promptTokens: number
    completionTokens: number
    totalCost?: number
  }
  executionTime?: number
  error?: string
}

// Transfer types
export interface TransferRequest {
  tokenId: string
  from: string
  to: string
  toPublicKey?: string
}

export interface TransferProof {
  sealedKey: string
  proof: string
  newEncryptedURI?: string
}

// Authorization types
export interface Authorization {
  executor: string
  permissions: {
    read: boolean
    execute: boolean
    modify: boolean
    expiresAt?: number
    maxExecutions?: number
    allowedActions?: string[]
  }
}

// Web3 types
export interface ContractAddresses {
  inft: `0x${string}`
  marketplace: `0x${string}`
  oracle: `0x${string}`
}

export interface TransactionStatus {
  hash: string
  status: 'pending' | 'success' | 'failed'
  confirmations: number
  error?: string
}

// UI State types
export interface UIState {
  isLoading: boolean
  error: string | null
  successMessage: string | null
}

export interface FilterOptions {
  model?: string
  priceRange?: [number, number]
  capabilities?: string[]
  sortBy?: 'recent' | 'price-low' | 'price-high' | 'popular'
}

// Form types
export interface MintFormData {
  name: string
  description: string
  model: string
  capabilities: string
  parameters?: string
  image?: File
}

export interface ListingFormData {
  price: string
  description?: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Event types
export interface ContractEvent {
  event: string
  args: any
  blockNumber: number
  transactionHash: string
  timestamp?: number
}

// Error types
export class Web3Error extends Error {
  code: string
  
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = 'Web3Error'
  }
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

export class ComputeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ComputeError'
  }
}

// Utility types
export type Address = `0x${string}`

export type ModelType = 'gpt-4' | 'claude-3' | 'llama-2' | 'custom'

export type AgentStatus = 'active' | 'inactive' | 'processing' | 'error'

export type NetworkName = '0g-testnet' | '0g-mainnet' | 'localhost'

// Constants
export const SUPPORTED_MODELS: ModelType[] = ['gpt-4', 'claude-3', 'llama-2', 'custom']

export const DEFAULT_CAPABILITIES = [
  'chat',
  'code generation',
  'analysis',
  'creative writing',
  'translation',
  'summarization',
  'question answering',
  'data processing'
]

export const MARKETPLACE_FEE_PERCENTAGE = 2.5

export const MIN_PRICE_WEI = BigInt('1000000000000000') // 0.001 OG

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']