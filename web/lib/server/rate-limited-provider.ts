import { ethers } from 'ethers'

interface RequestQueueItem {
  method: string
  params: any[]
  resolve: (value: any) => void
  reject: (error: any) => void
  timestamp: number
}

class RateLimitedProvider extends ethers.JsonRpcProvider {
  private requestQueue: RequestQueueItem[] = []
  private isProcessing = false
  private lastRequestTime = 0
  private readonly maxConcurrent = 4
  private readonly delayBetweenRequests = 200 // 200ms between requests
  private readonly retryDelays = [50, 100, 500, 1000, 2000] // exponential backoff
  private readonly cache = new Map<string, { result: any; timestamp: number }>()
  private readonly cacheTtl = 5000 // 5 seconds

  constructor(url: string, network?: ethers.Networkish) {
    super(url, network)
  }

  private getCacheKey(method: string, params: any[]): string {
    return `${method}:${JSON.stringify(params)}`
  }

  private getCachedResult(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.result
    }
    this.cache.delete(key)
    return null
  }

  private setCachedResult(key: string, result: any): void {
    this.cache.set(key, { result, timestamp: Date.now() })
    // Clean old cache entries
    if (this.cache.size > 100) {
      const now = Date.now()
      const keysToDelete: string[] = []
      
      this.cache.forEach((v, k) => {
        if (now - v.timestamp > this.cacheTtl) {
          keysToDelete.push(k)
        }
      })
      
      keysToDelete.forEach(k => this.cache.delete(k))
    }
  }

  async send(method: string, params: any[]): Promise<any> {
    // Check cache for read-only methods
    if (method === 'eth_chainId' || method === 'eth_getBalance' || method.startsWith('eth_call')) {
      const cacheKey = this.getCacheKey(method, params)
      const cached = this.getCachedResult(cacheKey)
      if (cached !== null) {
        return cached
      }
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        method,
        params,
        resolve,
        reject,
        timestamp: Date.now()
      })
      
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift()!
      
      try {
        // Rate limiting
        const now = Date.now()
        const timeSinceLastRequest = now - this.lastRequestTime
        if (timeSinceLastRequest < this.delayBetweenRequests) {
          await new Promise(resolve => setTimeout(resolve, this.delayBetweenRequests - timeSinceLastRequest))
        }

        const result = await this.sendWithRetry(request.method, request.params)
        
        // Cache the result if it's a read-only method
        if (request.method === 'eth_chainId' || request.method === 'eth_getBalance' || request.method.startsWith('eth_call')) {
          const cacheKey = this.getCacheKey(request.method, request.params)
          this.setCachedResult(cacheKey, result)
        }
        
        request.resolve(result)
        this.lastRequestTime = Date.now()
        
      } catch (error) {
        request.reject(error)
      }
    }

    this.isProcessing = false
  }

  private async sendWithRetry(method: string, params: any[], retryCount = 0): Promise<any> {
    try {
      return await super.send(method, params)
    } catch (error: any) {
      // Check if it's a rate limit error
      if (error?.code === -32005 || error?.message?.includes('rate limit') || 
          error?.message?.includes('too many requests')) {
        
        if (retryCount < this.retryDelays.length) {
          const delay = this.retryDelays[retryCount] + Math.random() * 100 // Add jitter
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.sendWithRetry(method, params, retryCount + 1)
        }
      }
      
      throw error
    }
  }
}

let providerInstance: RateLimitedProvider | null = null

export function getRateLimitedProvider(): RateLimitedProvider {
  if (providerInstance) return providerInstance
  
  const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpcUrl) {
    throw new Error('NEXT_PUBLIC_0G_RPC_URL not found in environment')
  }
  
  const chainId = process.env.NEXT_PUBLIC_0G_CHAIN_ID
  const network = chainId ? { chainId: parseInt(chainId), name: '0g-testnet' } : undefined
  
  providerInstance = new RateLimitedProvider(rpcUrl, network)
  return providerInstance
}

export { RateLimitedProvider }