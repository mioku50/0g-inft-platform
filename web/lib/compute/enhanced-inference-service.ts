import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import {
  getComputeLedgerContract,
  getComputeInferenceContract,
  getFineTuningServingAddress
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

// Enhanced caching with TTL and LRU
interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
}

class EnhancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private ttl: number

  constructor(maxSize = 100, ttl = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    entry.accessCount++
    return entry.data
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used item
      let lruKey = ''
      let lruCount = Infinity
      for (const [k, entry] of this.cache.entries()) {
        if (entry.accessCount < lruCount) {
          lruCount = entry.accessCount
          lruKey = k
        }
      }
      if (lruKey) this.cache.delete(lruKey)
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      accessCount: 0
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

// Rate limiting with exponential backoff
class RateLimiter {
  private attempts = new Map<string, number[]>()
  private backoffDelay = new Map<string, number>()
  private maxRetries = 3
  private baseDelay = 1000 // 1 second
  private maxDelay = 30000 // 30 seconds

  async checkRateLimit(key: string): Promise<void> {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []
    
    // Clean old attempts (older than 1 minute)
    const recentAttempts = attempts.filter(time => now - time < 60000)
    this.attempts.set(key, recentAttempts)

    // Check if we need to apply backoff
    const currentDelay = this.backoffDelay.get(key) || 0
    if (currentDelay > 0) {
      const timeSinceLastFailure = now - Math.max(...recentAttempts)
      if (timeSinceLastFailure < currentDelay) {
        const remainingDelay = currentDelay - timeSinceLastFailure
        throw new Error(`Rate limited. Retry in ${Math.ceil(remainingDelay / 1000)}s`)
      } else {
        // Reset backoff
        this.backoffDelay.delete(key)
      }
    }

    // Check request rate (max 10 per minute)
    if (recentAttempts.length >= 10) {
      throw new Error('Rate limited: too many requests per minute')
    }

    // Record this attempt
    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)
  }

  recordFailure(key: string): void {
    const currentDelay = this.backoffDelay.get(key) || this.baseDelay
    const newDelay = Math.min(currentDelay * 2, this.maxDelay)
    this.backoffDelay.set(key, newDelay)
  }

  recordSuccess(key: string): void {
    this.backoffDelay.delete(key)
  }
}

// Enhanced timing and metrics
interface EnhancedTimingMetrics {
  initBroker: number
  discovery: number
  acknowledge: number
  getMetadata: number
  getHeaders: number
  providerRequest: number
  processResponse: number
  totalTTFB: number
  retryCount: number
  errors: string[]
  cacheHits: number
  rateLimitHits: number
}

interface CostMetrics {
  inputTokens: number
  outputTokens: number
  estimatedCost: number // in A0GI
  actualCost?: number // from blockchain
}

interface HealthMetrics {
  providerAvailability: Record<string, boolean>
  averageResponseTime: Record<string, number>
  successRate: Record<string, number>
  lastHealthCheck: number
}

interface EnhancedChatRequest {
  message: string
  agentMetadata: {
    name: string
    description: string
  }
  options?: {
    stream?: boolean
    temperature?: number
    maxTokens?: number
    preferredProvider?: string
  }
}

interface EnhancedChatResponse {
  success: boolean
  response?: string
  model?: string
  provider?: string
  isRealAI: boolean
  metadata: {
    timing: EnhancedTimingMetrics
    cost: CostMetrics
    health: HealthMetrics
    servicesFound?: number
    chatId?: string
    isVerified?: boolean
  }
}

export class EnhancedInferenceService {
  private privateKey: string | undefined
  private brokerCache = new EnhancedCache<any>(10, 5 * 60 * 1000) // 5 min TTL
  private serviceCache = new EnhancedCache<any[]>(5, 2 * 60 * 1000) // 2 min TTL
  private metadataCache = new EnhancedCache<any>(50, 10 * 60 * 1000) // 10 min TTL
  private acknowledgeCache = new EnhancedCache<boolean>(50, 10 * 60 * 1000) // 10 min TTL
  private rateLimiter = new RateLimiter()
  private healthMetrics: HealthMetrics = {
    providerAvailability: {},
    averageResponseTime: {},
    successRate: {},
    lastHealthCheck: 0
  }

  // Official 0G providers from docs
  private readonly OFFICIAL_PROVIDERS = [
    {
      address: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      model: 'llama-3.3-70b-instruct',
      description: 'State-of-the-art 70B parameter model for general AI tasks',
      verification: 'TeeML',
      priority: 1
    },
    {
      address: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
      model: 'deepseek-r1-70b',
      description: 'Advanced reasoning model optimized for complex problem solving',
      verification: 'TeeML',
      priority: 2
    }
  ]

  constructor(privateKey?: string) {
    this.privateKey = privateKey
  }

  async processChat(request: EnhancedChatRequest): Promise<EnhancedChatResponse> {
    const startTime = Date.now()
    const timing: EnhancedTimingMetrics = {
      initBroker: 0,
      discovery: 0,
      acknowledge: 0,
      getMetadata: 0,
      getHeaders: 0,
      providerRequest: 0,
      processResponse: 0,
      totalTTFB: 0,
      retryCount: 0,
      errors: [],
      cacheHits: 0,
      rateLimitHits: 0
    }

    const cost: CostMetrics = {
      inputTokens: this.estimateTokens(request.message),
      outputTokens: 0,
      estimatedCost: 0
    }

    try {
      // Rate limiting check
      try {
        await this.rateLimiter.checkRateLimit('global')
      } catch (rateLimitError: any) {
        timing.rateLimitHits++
        timing.errors.push(rateLimitError.message)
        return this.createEnhancedFallbackResponse(timing, cost, rateLimitError.message, 0)
      }

      // 1. Initialize broker with enhanced caching
      const brokerStart = Date.now()
      const broker = await this.getBrokerWithCache()
      timing.initBroker = Date.now() - brokerStart

      // 2. Discover services with caching and health checks
      const discoveryStart = Date.now()
      const services = await this.discoverServicesWithHealth(broker)
      timing.discovery = Date.now() - discoveryStart

      if (services.length === 0) {
        return this.createEnhancedFallbackResponse(timing, cost, 'No healthy services found', 0)
      }

      // 3. Try providers with enhanced retry logic
      const providerStart = Date.now()
      const result = await this.tryProvidersWithEnhancedRetry(broker, services, request, timing, cost)
      timing.providerRequest = Date.now() - providerStart

      if (result) {
        timing.totalTTFB = Date.now() - startTime
        this.rateLimiter.recordSuccess('global')

        return {
          success: true,
          response: result.response,
          model: result.model,
          provider: result.provider,
          isRealAI: true,
          metadata: {
            timing,
            cost,
            health: this.healthMetrics,
            servicesFound: services.length,
            chatId: result.chatId,
            isVerified: result.isVerified
          }
        }
      }

      // All providers failed
      timing.totalTTFB = Date.now() - startTime
      this.rateLimiter.recordFailure('global')
      return this.createEnhancedFallbackResponse(timing, cost, 'All providers failed', services.length)

    } catch (error: any) {
      timing.totalTTFB = Date.now() - startTime
      timing.errors.push(error.message)
      this.rateLimiter.recordFailure('global')
      console.error('Enhanced inference error:', error)
      return this.createEnhancedFallbackResponse(timing, cost, 'Service error', 0)
    }
  }

  private async getBrokerWithCache(): Promise<any> {
    const cacheKey = 'broker'
    let broker = this.brokerCache.get(cacheKey)
    
    if (broker) {
      console.log('Using cached broker')
      return broker
    }

    console.log('Initializing new enhanced broker...')
    
    try {
      const provider = create0GProvider()
      if (!this.privateKey) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      const wallet = new ethers.Wallet(this.privateKey, provider)
      
      broker = await createZGComputeNetworkBroker(
        wallet,
        getComputeLedgerContract(),
        getComputeInferenceContract(),
        getFineTuningServingAddress()
      )

      // Ensure minimum balance with retry logic
      await this.ensureMinBalanceWithRetry(broker)

      this.brokerCache.set(cacheKey, broker)
      return broker
    } catch (error: any) {
      throw new Error(`Failed to initialize enhanced broker: ${error.message}`)
    }
  }

  private async ensureMinBalanceWithRetry(broker: any, maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const ledgerInfo = await broker.ledger.getLedger()
        const balance = Number(ethers.formatEther(ledgerInfo.balance || '0'))
        const minBalance = 0.02

        console.log(`Ledger balance: ${balance} OG (attempt ${attempt}/${maxRetries})`)

        if (balance < minBalance) {
          console.log('Low balance, adding funds...')
          const addAmount = ethers.parseEther('0.05')
          await broker.ledger.addLedger(addAmount)
          console.log('Funds added successfully')
        }
        return // Success
      } catch (error: any) {
        console.log(`Balance check attempt ${attempt} failed:`, error.message)
        if (attempt === maxRetries) {
          console.log('Balance check failed after all retries (non-critical)')
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
        }
      }
    }
  }

  private async discoverServicesWithHealth(broker: any): Promise<any[]> {
    const cacheKey = 'services'
    let services = this.serviceCache.get(cacheKey)
    
    if (services) {
      console.log('Using cached services')
      return services
    }

    try {
      const allServices = await broker.inference.listService()
      console.log(`Discovered ${allServices.length} services`)
      
      // Filter and prioritize official providers
      const officialAddresses = this.OFFICIAL_PROVIDERS.map(p => p.address.toLowerCase())
      const prioritizedServices = allServices
        .filter((service: any) => service.verifiability === 'TeeML') // Only TEE-verified services
        .sort((a: any, b: any) => {
          const aIsOfficial = officialAddresses.includes(a.provider.toLowerCase())
          const bIsOfficial = officialAddresses.includes(b.provider.toLowerCase())
          if (aIsOfficial && !bIsOfficial) return -1
          if (!aIsOfficial && bIsOfficial) return 1
          return 0
        })

      // Update health metrics
      this.updateHealthMetrics(prioritizedServices)
      
      this.serviceCache.set(cacheKey, prioritizedServices)
      return prioritizedServices
    } catch (error: any) {
      throw new Error(`Enhanced service discovery failed: ${error.message}`)
    }
  }

  private updateHealthMetrics(services: any[]): void {
    const now = Date.now()
    
    for (const service of services) {
      // Initialize if not exists
      if (!this.healthMetrics.providerAvailability[service.provider]) {
        this.healthMetrics.providerAvailability[service.provider] = true
        this.healthMetrics.averageResponseTime[service.provider] = 0
        this.healthMetrics.successRate[service.provider] = 1.0
      }
    }
    
    this.healthMetrics.lastHealthCheck = now
  }

  private async tryProvidersWithEnhancedRetry(
    broker: any,
    services: any[],
    request: EnhancedChatRequest,
    timing: EnhancedTimingMetrics,
    cost: CostMetrics
  ): Promise<any | null> {
    // If user has a preferred provider, try it first
    if (request.options?.preferredProvider) {
      const preferredService = services.find(s => s.provider === request.options?.preferredProvider)
      if (preferredService) {
        services = [preferredService, ...services.filter(s => s.provider !== request.options?.preferredProvider)]
      }
    }

    // Try providers sequentially with enhanced error handling
    for (const service of services) {
      const providerKey = service.provider
      
      try {
        // Check provider-specific rate limiting
        await this.rateLimiter.checkRateLimit(providerKey)
        
        const result = await this.tryProviderEnhanced(broker, service, request, timing, cost)
        if (result) {
          this.rateLimiter.recordSuccess(providerKey)
          this.updateProviderHealthMetrics(providerKey, true, result.responseTime)
          return result
        }
      } catch (error: any) {
        timing.errors.push(`${service.model}: ${error.message}`)
        this.rateLimiter.recordFailure(providerKey)
        this.updateProviderHealthMetrics(providerKey, false, 0)
        
        if (error.message.includes('Rate limited')) {
          timing.rateLimitHits++
        }
        
        console.log(`Provider ${service.provider} failed: ${error.message}`)
        // Continue to next provider
      }
    }
    
    return null // All providers failed
  }

  private async tryProviderEnhanced(
    broker: any,
    service: any,
    request: EnhancedChatRequest,
    timing: EnhancedTimingMetrics,
    cost: CostMetrics
  ): Promise<any> {
    const providerStart = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    try {
      console.log(`Trying enhanced provider: ${service.model} at ${service.provider}`)

      // 1. Acknowledge provider with caching
      const ackStart = Date.now()
      await this.acknowledgeProviderWithCache(broker, service.provider)
      timing.acknowledge += Date.now() - ackStart

      // 2. Get service metadata with caching
      const metadataStart = Date.now()
      const metadata = await this.getServiceMetadataWithCache(broker, service.provider)
      timing.getMetadata += Date.now() - metadataStart

      // 3. Generate headers
      const headersStart = Date.now()
      const headers = await broker.inference.getRequestHeaders(service.provider, request.message)
      timing.getHeaders += Date.now() - headersStart

      // 4. Prepare enhanced request
      const requestBody = {
        messages: [
          { 
            role: 'system' as const, 
            content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}` 
          },
          { role: 'user' as const, content: request.message }
        ],
        model: metadata.model,
        stream: request.options?.stream || false,
        temperature: request.options?.temperature || 0.7,
        max_tokens: request.options?.maxTokens || 2000
      }

      // 5. Make request with enhanced error handling
      const requestStart = Date.now()
      let completion: any
      let aiResponse: string
      let chatId: string | undefined

      try {
        const openai = new OpenAI({
          baseURL: metadata.endpoint,
          apiKey: ''
        })

        completion = await openai.chat.completions.create(requestBody, {
          headers: headers,
          signal: controller.signal
        })

        aiResponse = completion.choices[0].message.content || ''
        chatId = completion.id
        
      } catch (sdkError: any) {
        console.log(`OpenAI SDK failed, trying fetch: ${sdkError.message}`)
        
        // Fallback to fetch
        const response = await fetch(`${metadata.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        aiResponse = data.choices[0].message.content || ''
        chatId = data.id
      }

      const requestTime = Date.now() - requestStart

      // 6. Process response with verification
      const processStart = Date.now()
      let isVerified = false
      try {
        if (chatId) {
          isVerified = await broker.inference.processResponse(
            service.provider,
            aiResponse,
            chatId
          )
          console.log(`✅ Enhanced success with ${service.model}, verified: ${isVerified}`)
        }
      } catch (e) {
        console.log('Process response error (non-critical):', (e as any).message)
      }
      timing.processResponse += Date.now() - processStart

      // Update cost metrics
      cost.outputTokens = this.estimateTokens(aiResponse)
      cost.estimatedCost = this.estimateCost(cost.inputTokens, cost.outputTokens, service.inputPrice, service.outputPrice)

      const responseTime = Date.now() - providerStart
      
      return {
        response: aiResponse,
        model: metadata.model,
        provider: service.provider,
        chatId,
        isVerified,
        responseTime
      }

    } catch (error: any) {
      console.log(`Enhanced provider ${service.provider} failed: ${error.message}`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async acknowledgeProviderWithCache(broker: any, providerAddress: string): Promise<void> {
    const cacheKey = `ack_${providerAddress}`
    
    if (this.acknowledgeCache.get(cacheKey)) {
      console.log('Provider already acknowledged (cached)')
      return
    }

    try {
      console.log('Acknowledging provider with enhanced logic...')
      const ackTx = await broker.inference.acknowledgeProviderSigner(providerAddress)
      
      if (ackTx && ackTx.hash) {
        console.log(`Acknowledge tx: ${ackTx.hash}`)
        try {
          await ackTx.wait()
        } catch (waitErr: any) {
          console.log('Ack wait error (non-critical):', waitErr.message)
        }
      }

      this.acknowledgeCache.set(cacheKey, true)
      console.log('Provider acknowledged successfully!')
      
    } catch (ackError: any) {
      if (ackError.message.includes('already acknowledged')) {
        console.log('Provider already acknowledged')
        this.acknowledgeCache.set(cacheKey, true)
      } else {
        throw new Error(`Enhanced acknowledge failed: ${ackError.message}`)
      }
    }
  }

  private async getServiceMetadataWithCache(broker: any, providerAddress: string): Promise<any> {
    const cacheKey = `metadata_${providerAddress}`
    
    let metadata = this.metadataCache.get(cacheKey)
    if (metadata) {
      console.log('Using cached service metadata')
      return metadata
    }

    metadata = await broker.inference.getServiceMetadata(providerAddress)
    console.log(`Enhanced service endpoint: ${metadata.endpoint}`)
    
    this.metadataCache.set(cacheKey, metadata)
    return metadata
  }

  private updateProviderHealthMetrics(provider: string, success: boolean, responseTime: number): void {
    if (!this.healthMetrics.providerAvailability[provider]) {
      this.healthMetrics.providerAvailability[provider] = success
      this.healthMetrics.averageResponseTime[provider] = responseTime
      this.healthMetrics.successRate[provider] = success ? 1.0 : 0.0
    } else {
      this.healthMetrics.providerAvailability[provider] = success
      
      // Update rolling average
      const currentAvg = this.healthMetrics.averageResponseTime[provider]
      this.healthMetrics.averageResponseTime[provider] = (currentAvg * 0.8) + (responseTime * 0.2)
      
      // Update rolling success rate
      const currentRate = this.healthMetrics.successRate[provider]
      this.healthMetrics.successRate[provider] = (currentRate * 0.9) + (success ? 0.1 : 0.0)
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4)
  }

  private estimateCost(inputTokens: number, outputTokens: number, inputPrice?: bigint, outputPrice?: bigint): number {
    if (!inputPrice || !outputPrice) return 0
    
    try {
      const inputCost = (Number(ethers.formatEther(inputPrice)) * inputTokens)
      const outputCost = (Number(ethers.formatEther(outputPrice)) * outputTokens)
      return inputCost + outputCost
    } catch {
      return 0
    }
  }

  private createEnhancedFallbackResponse(
    timing: EnhancedTimingMetrics,
    cost: CostMetrics,
    reason: string,
    servicesFound: number = 0
  ): EnhancedChatResponse {
    return {
      success: true,
      response: `I'm currently experiencing connectivity issues with the 0G Compute Network.

🔄 **Enhanced Status Report:**
- Services discovered: ${servicesFound}
- Issue: ${reason}
- Total errors: ${timing.errors.length}
- Rate limit hits: ${timing.rateLimitHits}
- Cache hits: ${timing.cacheHits}

I'm operating in local mode for now. How can I help you?`,
      model: 'local-fallback-enhanced',
      provider: 'local',
      isRealAI: false,
      metadata: {
        timing,
        cost,
        health: this.healthMetrics,
        servicesFound
      }
    }
  }

  // Health check endpoint
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    providers: any
    metrics: HealthMetrics
    cache: {
      brokerHits: number
      serviceHits: number
      metadataHits: number
    }
  }> {
    const healthyProviders = Object.values(this.healthMetrics.providerAvailability).filter(Boolean).length
    const totalProviders = Object.keys(this.healthMetrics.providerAvailability).length
    
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyProviders === 0) {
      status = 'unhealthy'
    } else if (healthyProviders < totalProviders * 0.7) {
      status = 'degraded'
    } else {
      status = 'healthy'
    }

    return {
      status,
      providers: {
        healthy: healthyProviders,
        total: totalProviders,
        details: this.healthMetrics.providerAvailability
      },
      metrics: this.healthMetrics,
      cache: {
        brokerHits: 0, // TODO: Add cache hit counters
        serviceHits: 0,
        metadataHits: 0
      }
    }
  }
}