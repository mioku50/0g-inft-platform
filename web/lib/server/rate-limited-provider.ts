// lib/server/rate-limited-provider.ts
import { ethers } from 'ethers'

interface RateLimitedProviderOptions {
  maxConcurrent?: number
  delayBetweenRequests?: number
  chainIdCacheTtl?: number
}

class RateLimitedProvider extends ethers.JsonRpcProvider {
  private maxConcurrent: number
  private delayBetweenRequests: number
  private activeRequests = 0
  private requestQueue: Array<() => void> = []
  private lastRequestTime = 0
  private chainIdCache: { value: bigint | null; expiry: number } = { value: null, expiry: 0 }
  private chainIdCacheTtl: number

  constructor(url: string, options: RateLimitedProviderOptions = {}) {
    super(url)
    this.maxConcurrent = options.maxConcurrent ?? 4
    this.delayBetweenRequests = options.delayBetweenRequests ?? 200
    this.chainIdCacheTtl = options.chainIdCacheTtl ?? 5000
  }

  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      return
    }

    return new Promise(resolve => {
      this.requestQueue.push(resolve)
    })
  }

  private async waitForDelay(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.delayBetweenRequests) {
      const delay = this.delayBetweenRequests - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    this.lastRequestTime = Date.now()
  }

  private releaseSlot(): void {
    this.activeRequests--
    if (this.requestQueue.length > 0) {
      const nextResolver = this.requestQueue.shift()!
      nextResolver()
    }
  }

  private async withRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    await this.waitForSlot()
    this.activeRequests++

    try {
      await this.waitForDelay()
      return await operation()
    } catch (error: any) {
      // Handle rate limiting with exponential backoff
      if (error.code === -32005 || error.message?.includes('request rate exceeded')) {
        const backoffDelay = Math.min(1000 * Math.pow(2, this.activeRequests), 10000)
        console.log(`Rate limited, backing off for ${backoffDelay}ms`)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        return await operation()
      }
      throw error
    } finally {
      this.releaseSlot()
    }
  }

  async send(method: string, params: any[]): Promise<any> {
    // Cache eth_chainId calls
    if (method === 'eth_chainId') {
      const now = Date.now()
      if (this.chainIdCache.value && now < this.chainIdCache.expiry) {
        return this.chainIdCache.value
      }
    }

    const result = await this.withRateLimit(() => super.send(method, params))

    // Cache the chainId result
    if (method === 'eth_chainId') {
      this.chainIdCache = {
        value: result,
        expiry: Date.now() + this.chainIdCacheTtl
      }
    }

    return result
  }
}

export function create0GRateLimitedProvider(options?: RateLimitedProviderOptions): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  console.log('Created rate-limited RPC provider')
  return new RateLimitedProvider(rpcUrl, options)
}