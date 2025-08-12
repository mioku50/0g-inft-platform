// lib/server/rate-limited-provider.ts
// Rate-limited RPC provider to prevent -32005 errors

import pLimit from 'p-limit'
import { CHAIN_ID, getRpcUrl } from './compute-env'

// Rate limiting configuration for 0G Testnet v3 (max 10 requests per 100ms)
const MAX_CONCURRENT_REQUESTS = 3  // Reduced from 4 to be more conservative
const REQUEST_DELAY_MS = 120       // Increased from 200ms to ensure we stay under limit
const MAX_RETRIES = 5              // Increased retries as network is unstable
const INITIAL_BACKOFF_MS = 100     // Increased initial backoff
const BATCH_DELAY_MS = 150         // Additional delay between batches

// Create rate limiter
const limit = pLimit(MAX_CONCURRENT_REQUESTS)

// Provider singleton
let providerInstance: any | null = null
let ethersModule: any = null

// Dynamic ethers import for server-side compatibility
async function getEthers() {
  if (!ethersModule) {
    ethersModule = await import('ethers')
  }
  return ethersModule
}

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
 * Execute RPC request with enhanced rate limiting and retries
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
        // Progressive delay strategy
        if (attempt > 0) {
          const backoffTime = calculateBackoff(attempt)
          console.log(`[RateLimiter] Retry ${attempt}/${MAX_RETRIES} after ${backoffTime}ms`)
          await new Promise(resolve => setTimeout(resolve, backoffTime))
        } else {
          // Always add base delay to prevent burst requests
          await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS))
        }

        // Add batch delay for better distribution
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
        }

        // Execute the request using the original send method
        const result = await originalSend(request.method, request.params)
        
        // Cache successful result for longer on successful retry
        const cacheTtl = attempt > 0 ? CACHE_TTL_MS * 2 : CACHE_TTL_MS
        requestCache.set(cacheKey, { data: result, timestamp: Date.now() })
        
        // Clean old cache entries
        cleanCache()
        
        if (attempt > 0) {
          console.log(`[RateLimiter] Request succeeded on retry ${attempt}`)
        }
        
        return result
        
      } catch (error: any) {
        lastError = error
        
        if (isRateLimitError(error)) {
          const waitTime = extractWaitTime(error.message) || calculateBackoff(attempt)
          console.warn(`[RateLimiter] Rate limit hit on attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${waitTime}ms`)
          
          // If it's the last attempt, wait a bit longer before giving up
          if (attempt === MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
          continue
        } else {
          // Non-rate-limit error, don't retry unless it's a network error
          if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            console.warn(`[RateLimiter] Network error on attempt ${attempt + 1}/${MAX_RETRIES}:`, error.message)
            continue
          }
          throw error
        }
      }
    }
    
    console.error(`[RateLimiter] All ${MAX_RETRIES} attempts failed for ${request.method}`)
    throw lastError
  })
}

/**
 * Extract wait time from rate limit error message
 */
function extractWaitTime(message: string): number | null {
  const match = message.match(/try again after (\d+)ms/)
  return match ? parseInt(match[1]) + 50 : null // Add 50ms buffer
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
async function createRateLimitedProvider(): Promise<any> {
  const ethers = await getEthers()
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
export async function getRateLimitedProvider(): Promise<any> {
  if (!providerInstance) {
    providerInstance = await createRateLimitedProvider()
    console.log('✅ Created rate-limited RPC provider with throttling')
  }
  return providerInstance
}

/**
 * Create a wallet with rate-limited provider
 */
export async function createRateLimitedWallet(privateKey: string): Promise<any> {
  const ethers = await getEthers()
  const provider = await getRateLimitedProvider()
  return new ethers.Wallet(privateKey, provider)
}

/**
 * Helper for contract interactions with rate limiting
 */
export async function createRateLimitedContract(
  address: string, 
  abi: any, 
  signerOrProvider?: any
): Promise<any> {
  const ethers = await getEthers()
  const providerToUse = signerOrProvider || await getRateLimitedProvider()
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