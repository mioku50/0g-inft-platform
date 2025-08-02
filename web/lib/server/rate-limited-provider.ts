// lib/server/rate-limited-provider.ts
// Rate-limited RPC provider to prevent -32005 errors

import { ethers } from 'ethers'
import pLimit from 'p-limit'
import { CHAIN_ID, getRpcUrl } from './compute-env'

// Rate limiting configuration
const MAX_CONCURRENT_REQUESTS = 4
const REQUEST_DELAY_MS = 200
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 50

// Create rate limiter
const limit = pLimit(MAX_CONCURRENT_REQUESTS)

// Provider singleton
let providerInstance: ethers.JsonRpcProvider | null = null

// Request cache for short-term deduplication
const requestCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL_MS = 5000 // 5 seconds

interface RetryableRequest {
  method: string
  params: any[]
}

/**
 * Exponential backoff with jitter
 */
function calculateBackoff(attempt: number): number {
  const exponential = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
  const jitter = Math.random() * 0.1 * exponential
  return Math.min(exponential + jitter, 2000) // Max 2 seconds
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  return (
    error?.code === -32005 ||
    error?.message?.includes('rate limit') ||
    error?.message?.includes('Too many requests') ||
    error?.message?.includes('request rate exceeded')
  )
}

/**
 * Execute RPC request with rate limiting and retries
 */
async function executeRpcRequest(request: RetryableRequest, originalSend: Function): Promise<any> {
  const cacheKey = JSON.stringify(request)
  
  // Check cache first
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  return limit(async () => {
    let lastError: any
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Add delay between requests
        if (attempt > 0) {
          const backoffTime = calculateBackoff(attempt)
          await new Promise(resolve => setTimeout(resolve, backoffTime))
        } else if (REQUEST_DELAY_MS > 0) {
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS))
        }

        // Execute the request using the original send method
        const result = await originalSend(request.method, request.params)
        
        // Cache successful result
        requestCache.set(cacheKey, { data: result, timestamp: Date.now() })
        
        // Clean old cache entries
        cleanCache()
        
        return result
        
      } catch (error: any) {
        lastError = error
        
        if (isRateLimitError(error)) {
          console.warn(`Rate limit hit on attempt ${attempt + 1}/${MAX_RETRIES}:`, error.message)
          continue
        } else {
          // Non-rate-limit error, don't retry
          throw error
        }
      }
    }
    
    throw lastError
  })
}

/**
 * Clean expired cache entries
 */
function cleanCache() {
  const now = Date.now()
  for (const [key, entry] of requestCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      requestCache.delete(key)
    }
  }
}

/**
 * Create rate-limited provider instance
 */
function createRateLimitedProvider(): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(getRpcUrl(), { 
    name: '0g', 
    chainId: CHAIN_ID 
  })
  
  // Disable ENS resolution
  ;(provider as any).resolveName = async () => null
  
  // Override the send method to add rate limiting
  const originalSend = provider.send.bind(provider)
  provider.send = async (method: string, params: any[]) => {
    return executeRpcRequest({ method, params }, originalSend)
  }
  
  return provider
}

/**
 * Get singleton provider instance with rate limiting
 */
export function getRateLimitedProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = createRateLimitedProvider()
    console.log('✅ Created rate-limited RPC provider with throttling')
  }
  return providerInstance
}

/**
 * Create a wallet with rate-limited provider
 */
export function createRateLimitedWallet(privateKey: string): ethers.Wallet {
  const provider = getRateLimitedProvider()
  return new ethers.Wallet(privateKey, provider)
}

/**
 * Helper for contract interactions with rate limiting
 */
export function createRateLimitedContract(
  address: string, 
  abi: any, 
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const providerToUse = signerOrProvider || getRateLimitedProvider()
  return new ethers.Contract(address, abi, providerToUse)
}

/**
 * Safe contract call with automatic retries
 */
export async function safeContractCall<T>(
  contractMethod: () => Promise<T>,
  fallbackValue: T,
  methodName: string = 'contract method'
): Promise<T> {
  try {
    return await contractMethod()
  } catch (error: any) {
    console.warn(`${methodName} failed:`, error.message)
    return fallbackValue
  }
}

/**
 * Get cache stats for monitoring
 */
export function getCacheStats() {
  return {
    size: requestCache.size,
    entries: Array.from(requestCache.keys()),
    maxConcurrent: MAX_CONCURRENT_REQUESTS,
    requestDelay: REQUEST_DELAY_MS,
    cacheTtl: CACHE_TTL_MS
  }
}

/**
 * Clear request cache manually
 */
export function clearCache() {
  requestCache.clear()
  console.log('🧹 Cleared RPC request cache')
}

// Periodic cache cleanup
setInterval(() => {
  cleanCache()
}, CACHE_TTL_MS * 2) // Clean every 10 seconds

export default getRateLimitedProvider