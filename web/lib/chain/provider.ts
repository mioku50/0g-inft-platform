import { ethers } from 'ethers'
import pLimit from 'p-limit'

/**
 * Enhanced provider singleton with rate limiting and error handling
 * Prevents -32005 rate exceeded errors with intelligent throttling
 */
class EnhancedProvider {
  private static instance: EnhancedProvider
  private provider: ethers.JsonRpcProvider | null = null
  private limitedCall: any
  private chainIdCache: { value: string | null; timestamp: number } = { value: null, timestamp: 0 }
  private readonly CACHE_TTL = 5000 // 5 seconds
  private readonly MAX_CONCURRENT = 4
  private readonly BASE_DELAY = 50
  private readonly MAX_DELAY = 2000

  private constructor() {
    // Limit concurrent RPC requests to prevent rate limiting
    this.limitedCall = pLimit(this.MAX_CONCURRENT)
  }

  public static getInstance(): EnhancedProvider {
    if (!EnhancedProvider.instance) {
      EnhancedProvider.instance = new EnhancedProvider()
    }
    return EnhancedProvider.instance
  }

  public getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai'
      this.provider = new ethers.JsonRpcProvider(rpcUrl)
    }
    return this.provider
  }

  /**
   * Get chainId with caching and fallback to environment variable
   */
  public async getChainId(): Promise<string> {
    const now = Date.now()
    
    // Return cached value if still valid
    if (this.chainIdCache.value && (now - this.chainIdCache.timestamp) < this.CACHE_TTL) {
      return this.chainIdCache.value
    }

    try {
      const provider = this.getProvider()
      const network = await this.limitedCall(() => provider.getNetwork())
      const chainId = network.chainId.toString()
      
      // Update cache
      this.chainIdCache = { value: chainId, timestamp: now }
      
      console.log(`[EnhancedProvider] chainId: ${chainId} (from network)`)
      return chainId
    } catch (error) {
      console.warn(`[EnhancedProvider] Failed to get chainId from network:`, error)
      
      // Fallback to environment variable
      const envChainId = process.env.NEXT_PUBLIC_0G_CHAIN_ID || '16601'
      this.chainIdCache = { value: envChainId, timestamp: now }
      
      console.log(`[EnhancedProvider] chainId: ${envChainId} (from environment fallback)`)
      return envChainId
    }
  }

  /**
   * Rate-limited contract call with exponential backoff
   */
  public async callContract<T>(contractCall: () => Promise<T>, retries = 3): Promise<T> {
    return this.limitedCall(async () => {
      let lastError: any
      
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await contractCall()
        } catch (error: any) {
          lastError = error
          
          // Check for rate limit error
          const errorMessage = error.message || error.toString()
          if (errorMessage.includes('-32005') || errorMessage.includes('request rate exceeded')) {
            const delay = Math.min(
              this.BASE_DELAY * Math.pow(2, attempt) + Math.random() * 100, // Add jitter
              this.MAX_DELAY
            )
            
            console.warn(`[EnhancedProvider] Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }
          
          // Check for missing revert data
          if (errorMessage.includes('missing revert data')) {
            console.warn(`[EnhancedProvider] Missing revert data, retrying (attempt ${attempt + 1}/${retries})`)
            await new Promise(resolve => setTimeout(resolve, 200))
            continue
          }
          
          // Non-recoverable error, throw immediately
          throw error
        }
      }
      
      throw lastError
    })
  }

  /**
   * Create rate-limited wallet instance
   */
  public createWallet(privateKey: string): ethers.Wallet {
    const provider = this.getProvider()
    return new ethers.Wallet(privateKey, provider)
  }
}

export const enhancedProvider = EnhancedProvider.getInstance()
export default enhancedProvider