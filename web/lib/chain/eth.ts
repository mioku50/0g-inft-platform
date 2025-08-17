import { ethers } from 'ethers'
import enhancedProvider from './provider'
import pLimit from 'p-limit'

/**
 * Enhanced utilities for safe contract calls with rate limiting and error handling
 * Prevents -32005 rate exceeded errors and missing revert data
 */

// Rate limiting for batch operations
const limit = pLimit(5) // Max 5 concurrent requests
const BATCH_DELAY = 200 // 200ms between batches

/**
 * Safe static call wrapper - handles reverts gracefully
 */
export async function staticCallSafe<T>(
  contract: ethers.Contract, 
  functionName: string, 
  ...args: any[]
): Promise<T | null> {
  return enhancedProvider.callContract(async () => {
    try {
      // Use staticCall for read-only operations
      const result = await contract[functionName].staticCall(...args)
      return result
    } catch (error: any) {
      const errorMsg = error.message || error.toString()
      
      // Handle known error patterns gracefully
      if (errorMsg.includes('missing revert data') || 
          errorMsg.includes('CALL_EXCEPTION') ||
          errorMsg.includes('execution reverted')) {
        console.warn(`[staticCallSafe] ${functionName} reverted gracefully:`, errorMsg)
        return null
      }
      
      // Re-throw unexpected errors
      throw error
    }
  })
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  promiseFactory: () => Promise<T>,
  options: { tries?: number; baseMs?: number } = {}
): Promise<T> {
  const { tries = 3, baseMs = 150 } = options
  let lastError: any
  
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await promiseFactory()
    } catch (error: any) {
      lastError = error
      
      if (attempt === tries - 1) break // Last attempt, don't delay
      
      const delay = baseMs * Math.pow(2, attempt) + Math.random() * 50
      console.warn(`[withRetry] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Batch contract calls with rate limiting
 */
export async function batchContractCalls<T>(
  calls: (() => Promise<T>)[],
  options: { 
    batchSize?: number
    delayBetweenBatches?: number
  } = {}
): Promise<T[]> {
  const { batchSize = 5, delayBetweenBatches = BATCH_DELAY } = options
  const results: T[] = []
  
  // Process in batches to avoid overwhelming the RPC
  for (let i = 0; i < calls.length; i += batchSize) {
    const batch = calls.slice(i, i + batchSize)
    
    // Execute batch with rate limiting
    const batchResults = await Promise.all(
      batch.map(call => limit(call))
    )
    
    results.push(...batchResults)
    
    // Delay between batches (except for the last one)
    if (i + batchSize < calls.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }
  
  return results
}

/**
 * Safe token metadata loader with fallbacks
 */
export async function loadTokenMetadataSafe(
  contract: ethers.Contract,
  tokenId: string | number
): Promise<{
  id: string
  owner: string | null
  metadataHash: string | null
  tokenURI: string | null
  name?: string
  description?: string
  image?: string
  error?: string
}> {
  const id = tokenId.toString()
  
  try {
    // Use enhanced calls for basic token info
    const [owner, metadataHash, tokenURI] = await Promise.all([
      staticCallSafe(contract, 'ownerOf', tokenId),
      staticCallSafe(contract, 'getEncryptedURI', tokenId),
      staticCallSafe(contract, 'tokenURI', tokenId)
    ])
    
    // Try to parse metadata from tokenURI if available
    let metadata: any = {}
    if (tokenURI && typeof tokenURI === 'string') {
      try {
        // Handle IPFS URIs
        if (tokenURI.startsWith('ipfs://')) {
          // For now, just note that it's IPFS - actual fetching would need HTTP gateway
          metadata.source = 'ipfs'
        } else if (tokenURI.startsWith('http')) {
          // Could fetch HTTP URIs, but skip for now to avoid external deps
          metadata.source = 'http'
        } else if (tokenURI.startsWith('data:')) {
          // Handle data URIs
          const base64Data = tokenURI.split(',')[1]
          if (base64Data) {
            const decoded = Buffer.from(base64Data, 'base64').toString()
            metadata = JSON.parse(decoded)
          }
        }
      } catch (e) {
        console.warn(`[loadTokenMetadataSafe] Failed to parse metadata for token ${id}:`, e)
      }
    }
    
    return {
      id,
      owner,
      metadataHash,
      tokenURI,
      name: metadata.name || `Agent #${id}`,
      description: metadata.description || 'AI Agent',
      image: metadata.image || null
    }
    
  } catch (error: any) {
    console.error(`[loadTokenMetadataSafe] Failed to load token ${id}:`, error.message)
    
    return {
      id,
      owner: null,
      metadataHash: null,
      tokenURI: null,
      name: `Agent #${id}`,
      description: 'Failed to load metadata',
      error: error.message
    }
  }
}

/**
 * Enhanced provider instance
 */
export { enhancedProvider as default }