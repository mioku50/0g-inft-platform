// web/lib/compute/chat-service.ts
import { ethers } from 'ethers'
import { getBrokerOrThrow } from './broker'

// Types
interface ChatRequest {
  message: string
  agentMetadata: {
    name: string
    description: string
  }
}

interface ChatResponse {
  success: boolean
  response: string
  model?: string
  provider?: string
  isRealAI: boolean
  metadata?: {
    timing: PerformanceMetrics
    provider: string
    model: string
    isValid?: boolean
    chatId?: string
  }
  debug?: any
}

interface PerformanceMetrics {
  initBroker: number
  discoveryServices: number
  ackSigner: number
  providerRequestTime: number
  totalTTFB: number
}

interface ServiceInfo {
  provider: string
  model: string
  endpoint: string
  inputPrice: bigint
  outputPrice: bigint
  verifiability: string
  isOfficial: boolean
  isVerifiable: boolean
}

// Constants
const CHAT_TIMEOUT = 20000 // 20 seconds total timeout
const PROVIDER_TIMEOUT = 15000 // 15 seconds per provider
const ACK_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const FALLBACK_FEE = ethers.parseEther('0.01')

// In-memory caches
const ackCache = new Map<string, number>()
const brokerCache = { instance: null as any, lastInit: 0 }
const BROKER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Official provider addresses for priority
const OFFICIAL_PROVIDERS = [
  '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
  '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
]

export class ChatService {
  private startTime: number = 0
  private metrics: Partial<PerformanceMetrics> = {}

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    this.startTime = Date.now()
    
    try {
      // Initialize broker with timing
      const broker = await this.initializeBroker()
      this.metrics.initBroker = Date.now() - this.startTime

      // Ensure ledger has sufficient balance
      await this.ensureSufficientBalance(broker)

      // Discover services with timing
      const discoverStart = Date.now()
      const services = await this.discoverServices(broker)
      this.metrics.discoveryServices = Date.now() - discoverStart

      if (services.length === 0) {
        return this.createFallbackResponse(request, 'No AI services available')
      }

      // Try providers in parallel with race condition
      const providerStart = Date.now()
      const result = await this.tryProvidersParallel(broker, services, request)
      this.metrics.providerRequestTime = Date.now() - providerStart
      this.metrics.totalTTFB = Date.now() - this.startTime

      if (result) {
        return {
          ...result,
          metadata: {
            ...result.metadata,
            timing: this.metrics as PerformanceMetrics
          }
        }
      }

      // All providers failed
      return this.createFallbackResponse(request, 'All AI providers failed', services)

    } catch (error: any) {
      console.error('Chat service error:', error)
      return this.createErrorResponse(error)
    }
  }

  private async initializeBroker() {
    const now = Date.now()
    
    // Return cached broker if still valid
    if (brokerCache.instance && (now - brokerCache.lastInit) < BROKER_CACHE_TTL) {
      console.log('Using cached broker')
      return brokerCache.instance
    }

    console.log('Initializing new broker...')
    const broker = await getBrokerOrThrow()
    
    // Cache the broker
    brokerCache.instance = broker
    brokerCache.lastInit = now
    
    return broker
  }

  private async ensureSufficientBalance(broker: any) {
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      const balance = BigInt(ledgerInfo.balance?.toString() || '0')
      const minBalance = ethers.parseEther('0.02')

      console.log('Ledger balance:', ethers.formatEther(balance), 'OG')

      if (balance < minBalance) {
        console.log('Low balance, adding funds...')
        await broker.ledger.addLedger(ethers.parseEther('0.05'))
        console.log('Funds added successfully')
      }
    } catch (error: any) {
      console.warn('Balance check/top-up failed:', error.message)
      // Continue anyway - the provider will reject if truly insufficient
    }
  }

  private async discoverServices(broker: any): Promise<ServiceInfo[]> {
    try {
      const services = await broker.inference.listService()
      console.log(`Discovered ${services.length} services`)

      return services.map((service: any) => ({
        provider: service.provider,
        model: service.model,
        endpoint: '', // Will be filled later
        inputPrice: BigInt(service.inputPrice?.toString() || '0'),
        outputPrice: BigInt(service.outputPrice?.toString() || '0'),
        verifiability: service.verifiability || '',
        isOfficial: OFFICIAL_PROVIDERS.includes(service.provider),
        isVerifiable: service.verifiability === 'TeeML'
      })).sort((a: ServiceInfo, b: ServiceInfo) => {
        // Prioritize official providers
        if (a.isOfficial && !b.isOfficial) return -1
        if (!a.isOfficial && b.isOfficial) return 1
        return 0
      })
    } catch (error: any) {
      console.error('Service discovery failed:', error.message)
      return []
    }
  }

  private async tryProvidersParallel(
    broker: any, 
    services: ServiceInfo[], 
    request: ChatRequest
  ): Promise<ChatResponse | null> {
    // Create promises for each provider
    const providerPromises = services.map(service => 
      this.tryProvider(broker, service, request)
        .catch(error => {
          console.log(`Provider ${service.provider} failed:`, error.message)
          return null
        })
    )

    // Use Promise.any to get the first successful response
    try {
      const result = await Promise.any(providerPromises)
      return result
    } catch (error) {
      // All providers failed
      console.log('All providers failed in parallel execution')
      return null
    }
  }

  private async tryProvider(
    broker: any, 
    service: ServiceInfo, 
    request: ChatRequest
  ): Promise<ChatResponse> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Provider ${service.provider} timeout`))
      }, PROVIDER_TIMEOUT)

      try {
        console.log(`Trying provider: ${service.model} at ${service.provider}`)

        // Acknowledge provider if needed
        await this.acknowledgeProviderIfNeeded(broker, service.provider)

        // Get service metadata
        const metadata = await broker.inference.getServiceMetadata(service.provider)
        console.log('Service endpoint:', metadata.endpoint)

        // Generate request headers
        const headers = await broker.inference.getRequestHeaders(
          service.provider, 
          request.message
        )

        // Make the AI request
        const aiResponse = await this.makeAIRequest(
          metadata.endpoint,
          metadata.model,
          request,
          headers
        )

        // Process response for verification
        let isValid = true
        try {
          if (service.isVerifiable && aiResponse.chatId) {
            isValid = await broker.inference.processResponse(
              service.provider,
              aiResponse.content,
              aiResponse.chatId
            )
          }
        } catch (error: any) {
          console.warn('Response verification failed:', error.message)
          isValid = false
        }

        clearTimeout(timeout)
        resolve({
          success: true,
          response: aiResponse.content,
          model: metadata.model,
          provider: service.provider,
          isRealAI: true,
          metadata: {
            timing: {} as PerformanceMetrics, // Will be filled by caller
            provider: service.provider,
            model: metadata.model,
            isValid,
            chatId: aiResponse.chatId
          }
        })

      } catch (error: any) {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  private async acknowledgeProviderIfNeeded(broker: any, provider: string) {
    const now = Date.now()
    const lastAck = ackCache.get(provider)

    if (lastAck && (now - lastAck) < ACK_CACHE_TTL) {
      console.log('Provider already acknowledged (cached)')
      return
    }

    const ackStart = Date.now()
    try {
      console.log('Acknowledging provider...')
      const ackTx = await broker.inference.acknowledgeProviderSigner(provider)
      
      if (ackTx?.wait) {
        await ackTx.wait()
      }
      
      ackCache.set(provider, now)
      this.metrics.ackSigner = (this.metrics.ackSigner || 0) + (Date.now() - ackStart)
      console.log('Provider acknowledged successfully')
      
    } catch (error: any) {
      if (error.message.includes('already acknowledged')) {
        console.log('Provider already acknowledged')
        ackCache.set(provider, now)
      } else {
        throw new Error(`Acknowledge failed: ${error.message}`)
      }
    }
  }

  private async makeAIRequest(
    endpoint: string,
    model: string,
    request: ChatRequest,
    headers: any
  ): Promise<{ content: string; chatId?: string }> {
    const requestBody = {
      messages: [
        { 
          role: 'system', 
          content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}` 
        },
        { role: 'user', content: request.message }
      ],
      model: model,
      stream: false
    }

    // Try OpenAI SDK first
    try {
      const OpenAI = require('openai')
      const openai = new OpenAI({
        baseURL: endpoint,
        apiKey: ''
      })

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT - 1000)
      
      const completion = await openai.chat.completions.create(requestBody, {
        headers: headers,
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      return {
        content: completion.choices[0].message.content,
        chatId: completion.id
      }
      
    } catch (openaiError: any) {
      console.log('OpenAI SDK failed, trying fetch:', openaiError.message)
      
      // Fallback to fetch
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT - 1000)
      
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      return {
        content: data.choices[0].message.content,
        chatId: data.id
      }
    }
  }

  private createFallbackResponse(
    request: ChatRequest, 
    reason: string, 
    services: ServiceInfo[] = []
  ): ChatResponse {
    const response = `Hello! I'm ${request.agentMetadata.name}. ${request.agentMetadata.description}

🔄 Status Update:
${services.length > 0 ? `✅ Found ${services.length} AI services` : '❌ No AI services available'}
⚠️ ${reason}

I'm here with local intelligence. What would you like to discuss?`

    return {
      success: true,
      response,
      model: 'intelligent-local',
      provider: 'local',
      isRealAI: false,
      metadata: {
        timing: this.metrics as PerformanceMetrics,
        provider: 'local',
        model: 'intelligent-local'
      },
      debug: {
        reason,
        servicesFound: services.length,
        services: services.map(s => ({
          model: s.model,
          provider: s.provider.substring(0, 10) + '...',
          isOfficial: s.isOfficial,
          isVerifiable: s.isVerifiable
        }))
      }
    }
  }

  private createErrorResponse(error: any): ChatResponse {
    return {
      success: false,
      response: 'I apologize, but I encountered an error processing your request. Please try again.',
      isRealAI: false,
      metadata: {
        timing: this.metrics as PerformanceMetrics,
        provider: 'error',
        model: 'error'
      },
      debug: {
        error: error.message,
        timing: this.metrics
      }
    }
  }

  // Static method for easy access
  static async processChat(request: ChatRequest): Promise<ChatResponse> {
    const service = new ChatService()
    return service.processChat(request)
  }
}

// Export for backward compatibility
export async function processChat(request: ChatRequest): Promise<ChatResponse> {
  return ChatService.processChat(request)
}