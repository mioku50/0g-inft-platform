export const runtime = 'nodejs'

import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import {
  getComputeLedgerContract,
  getComputeInferenceContract,
  getFineTuningServingAddress
} from '@/lib/server/compute-env'
import { getRateLimitedProvider, createRateLimitedWallet } from '@/lib/server/rate-limited-provider'

// Enhanced broker caching with singleton pattern
interface BrokerCacheEntry {
  broker: any
  timestamp: number
  signerAddress: string
}

let brokerCache: BrokerCacheEntry | null = null
const BROKER_TTL = 10 * 60 * 1000 // 10 minutes

// Enhanced acknowledge cache with persistence 
const acknowledgeCache = new Map<string, { timestamp: number; result: any }>()
const ACKNOWLEDGE_TTL = 30 * 60 * 1000 // 30 minutes

// Service discovery cache
const serviceCache = new Map<string, { services: any[]; timestamp: number }>()
const SERVICE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Rate limiting for service calls
const REQUEST_TIMEOUT = 25000 // 25 seconds total timeout
const PROVIDER_TIMEOUT = 20000 // 20 seconds per provider

interface TimingMetrics {
  initBroker: number
  discovery: number
  ack: number
  providerRequest: number
  totalTTFB: number
}

interface ChatRequest {
  message: string
  agentMetadata: {
    name: string
    description: string
  }
}

interface ChatResponse {
  success: boolean
  response?: string
  model?: string
  provider?: string
  isRealAI: boolean
  metadata: {
    timing: TimingMetrics
    servicesFound?: number
    errors?: string[]
  }
}

export class ChatService {
  private privateKey: string | undefined

  constructor(privateKey?: string) {
    this.privateKey = privateKey
  }

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now()
    const timing: TimingMetrics = {
      initBroker: 0,
      discovery: 0,
      ack: 0,
      providerRequest: 0,
      totalTTFB: 0
    }
    const errors: string[] = []

    try {
      // 1. Инициализация брокера с кэшем
      const brokerStart = Date.now()
      const broker = await this.getBrokerSafe()
      timing.initBroker = Date.now() - brokerStart

      // 2. Обнаружение сервисов
      const discoveryStart = Date.now()
      const services = await this.discoverServices(broker)
      timing.discovery = Date.now() - discoveryStart

      if (services.length === 0) {
        return this.createFallbackResponse(timing, errors, 'No services found')
      }

      // 3. Параллельный запуск запросов к провайдерам
      const providerStart = Date.now()
      const result = await this.raceProviders(broker, services, request, timing)
      timing.providerRequest = Date.now() - providerStart

      if (result) {
        timing.totalTTFB = Date.now() - startTime
        return {
          success: true,
          response: result.response,
          model: result.model,
          provider: result.provider,
          isRealAI: true,
          metadata: { timing, servicesFound: services.length }
        }
      }

      // Все провайдеры упали
      timing.totalTTFB = Date.now() - startTime
      return this.createFallbackResponse(timing, errors, 'All providers failed', services.length)

    } catch (error: any) {
      timing.totalTTFB = Date.now() - startTime
      errors.push(error.message)
      console.error('ChatService error:', error)
      return this.createFallbackResponse(timing, errors, 'Service error', 0)
    }
  }

  private async getBrokerSafe(): Promise<any> {
    const now = Date.now()
    
    // Check cache with signer address validation
    if (brokerCache && (now - brokerCache.timestamp) < BROKER_TTL) {
      try {
        // Verify broker is still valid
        if (brokerCache.broker && brokerCache.broker.signerAddress) {
          console.log(`[ChatService] Using cached broker for ${brokerCache.signerAddress}`)
          return brokerCache.broker
        }
      } catch (e) {
        console.log('[ChatService] Cached broker validation failed, creating new one')
        brokerCache = null
      }
    }

    console.log('[ChatService] Initializing new broker with rate limiting...')
    
    try {
      // Use rate-limited provider
      const provider = getRateLimitedProvider()
      if (!this.privateKey) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      
      const wallet = createRateLimitedWallet(this.privateKey)
      
      const ledgerContract = getComputeLedgerContract()
      const inferenceContract = getComputeInferenceContract()
      const fineTuningContract = getFineTuningServingAddress()
      
      console.log('[ChatService] Creating broker with contracts:', {
        ledger: ledgerContract,
        inference: inferenceContract,
        fineTuning: fineTuningContract
      })
      
      const broker = await createZGComputeNetworkBroker(
        wallet,
        ledgerContract,
        inferenceContract,
        fineTuningContract
      )

      // Enhanced balance check with rate limiting
      await this.ensureMinBalance(broker)

      // Cache the broker with signer address
      brokerCache = { 
        broker, 
        timestamp: now,
        signerAddress: wallet.address
      }
      
      console.log(`[ChatService] Broker cached for ${wallet.address}`)
      return broker
    } catch (error: any) {
      console.error('[ChatService] Broker initialization failed:', error)
      throw new Error(`Failed to initialize broker: ${error.message}`)
    }
  }

  private async ensureMinBalance(broker: any): Promise<void> {
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      const balance = this.safeBigIntToNumber(ledgerInfo.balance)
      const minBalance = 0.02
      
      console.log(`Ledger balance: ${ethers.formatEther(ledgerInfo.balance)} OG`)
      
      if (balance < minBalance) {
        console.log('Low balance, adding funds...')
        const addAmount = ethers.parseEther('0.05')
        await broker.ledger.addLedger(addAmount)
        console.log('Funds added successfully')
      }
    } catch (error: any) {
      console.log('Balance check error (non-critical):', error.message)
      // Не прерываем работу при ошибках баланса
    }
  }

  private safeBigIntToNumber(value: any): number {
    try {
      if (typeof value === 'bigint') {
        return Number(ethers.formatEther(value))
      }
      if (typeof value === 'string') {
        return Number(ethers.formatEther(BigInt(value)))
      }
      return Number(ethers.formatEther(BigInt(value?.toString?.() ?? '0')))
    } catch (error) {
      console.log('BigInt conversion error:', error)
      return 0
    }
  }

  private async discoverServices(broker: any): Promise<any[]> {
    try {
      // Check service cache first
      const cached = serviceCache.get('services')
      const now = Date.now()
      
      if (cached && (now - cached.timestamp) < SERVICE_CACHE_TTL) {
        console.log(`[ChatService] Using cached services (${cached.services.length} found)`)
        return cached.services
      }

      console.log('[ChatService] Discovering services with rate limiting...')
      const services = await broker.inference.listService()
      console.log(`[ChatService] Found ${services.length} services`)
      
      // Prioritize official providers with better error handling
      const officialProviders = [
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
        '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
      ]
      
      const sortedServices = [...services].sort((a: any, b: any) => {
        const aIsOfficial = officialProviders.includes(a.provider)
        const bIsOfficial = officialProviders.includes(b.provider)
        if (aIsOfficial && !bIsOfficial) return -1
        if (!aIsOfficial && bIsOfficial) return 1
        return 0
      })

      // Cache the results
      serviceCache.set('services', {
        services: sortedServices,
        timestamp: now
      })
      
      return sortedServices
    } catch (error: any) {
      console.error('[ChatService] Service discovery failed:', error)
      
      // Return fallback services if discovery fails
      const fallbackServices = [
        {
          provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
          model: 'llama-3.3-70b-instruct',
          url: 'https://api.0g.ai',
          verifiability: 'TeeML'
        }
      ]
      
      console.log('[ChatService] Using fallback services')
      return fallbackServices
    }
  }

  private async raceProviders(
    broker: any, 
    services: any[], 
    request: ChatRequest,
    timing: TimingMetrics
  ): Promise<any | null> {
    const promises = services.map(service => 
      this.tryProvider(broker, service, request, timing)
    )

    try {
      // Используем Promise.any для первого успешного ответа
      const result = await Promise.any(promises)
      return result
    } catch (error) {
      // Все провайдеры упали
      console.log('All providers failed in race')
      return null
    }
  }

  private async tryProvider(
    broker: any, 
    service: any, 
    request: ChatRequest,
    timing: TimingMetrics
  ): Promise<any> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT)

    try {
      console.log(`Trying provider: ${service.model} at ${service.provider}`)

      // 1. Acknowledge провайдера с кэшем
      const ackStart = Date.now()
      await this.acknowledgeProviderSafe(broker, service.provider)
      timing.ack += Date.now() - ackStart

      // 2. Получаем метаданные сервиса
      const metadata = await broker.inference.getServiceMetadata(service.provider)
      console.log(`Service endpoint: ${metadata.endpoint}`)

      // 3. Генерируем headers
      const headers = await broker.inference.getRequestHeaders(service.provider, request.message)

      // 4. Подготавливаем запрос
      const requestBody = {
        messages: [
          { 
            role: 'system' as const, 
            content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}` 
          },
          { role: 'user' as const, content: request.message }
        ],
        model: metadata.model,
        stream: false as const
      }

      // 5. Пробуем OpenAI SDK
      try {
        const openai = new OpenAI({
          baseURL: metadata.endpoint,
          apiKey: ''
        })

        const completion = await openai.chat.completions.create(requestBody, {
          headers: headers,
          signal: controller.signal
        })

        const aiResponse = completion.choices[0].message.content

        // 6. Обрабатываем ответ (верификация)
        try {
          const isValid = await broker.inference.processResponse(
            service.provider,
            aiResponse,
            completion.id
          )
          console.log(`✅ Success with ${service.model}, valid: ${isValid}`)
        } catch (e) {
          console.log('Process response error (non-critical):', (e as any).message)
        }

        return {
          response: aiResponse,
          model: metadata.model,
          provider: service.provider
        }

      } catch (sdkError: any) {
        console.log(`OpenAI SDK failed, trying fetch: ${sdkError.message}`)
        
        // 7. Fallback на fetch
        const response = await fetch(`${metadata.endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Success with fetch for ${service.model}`)
          
          return {
            response: data.choices[0].message.content,
            model: metadata.model,
            provider: service.provider
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      }

    } catch (error: any) {
      console.log(`Provider ${service.provider} failed: ${error.message}`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async acknowledgeProviderSafe(broker: any, providerAddress: string): Promise<void> {
    const now = Date.now()
    const cacheKey = `${broker.signerAddress || 'unknown'}_${providerAddress}`
    const lastAck = acknowledgeCache.get(cacheKey)

    if (lastAck && (now - lastAck.timestamp) < ACKNOWLEDGE_TTL) {
      console.log(`[ChatService] Provider ${providerAddress} already acknowledged (cached)`)
      return
    }

    try {
      console.log(`[ChatService] Acknowledging provider ${providerAddress}...`)
      const result = await broker.inference.acknowledgeProviderSigner(providerAddress)
      
      // Enhanced result handling
      if (result && result.hash) {
        console.log(`[ChatService] Acknowledge tx: ${result.hash}`)
        try {
          // Don't wait for confirmation to avoid blocking
          result.wait?.().then(() => {
            console.log(`[ChatService] Acknowledge confirmed for ${providerAddress}`)
          }).catch((err: any) => {
            console.log(`[ChatService] Acknowledge confirmation warning (non-critical):`, err.message)
          })
        } catch (waitErr: any) {
          console.log('[ChatService] Ack wait setup warning (non-critical):', waitErr.message)
        }
      } else {
        console.log(`[ChatService] Provider signer already acknowledged (no tx emitted)`)
      }

      // Cache the acknowledgment result
      acknowledgeCache.set(cacheKey, { timestamp: now, result })
      console.log(`[ChatService] Provider ${providerAddress} acknowledged and cached`)
      
    } catch (ackError: any) {
      console.log(`[ChatService] Acknowledge error:`, ackError.message)
      
      // Handle "already acknowledged" cases
      if (ackError.message.includes('already acknowledged') || 
          ackError.message.includes('AlreadyAcknowledged') ||
          ackError.message.includes('signer is already acknowledged')) {
        console.log(`[ChatService] Provider ${providerAddress} was already acknowledged`)
        acknowledgeCache.set(cacheKey, { timestamp: now, result: { alreadyAcknowledged: true } })
      } else {
        // Re-throw non-acknowledgment errors
        throw new Error(`Acknowledge failed for ${providerAddress}: ${ackError.message}`)
      }
    }
  }

  private createFallbackResponse(
    timing: TimingMetrics, 
    errors: string[], 
    reason: string,
    servicesFound: number = 0
  ): ChatResponse {
    return {
      success: true,
      response: `I'm currently experiencing connectivity issues with the 0G Compute Network.

🔄 **Status Report:**
- Services discovered: ${servicesFound}
- Issue: ${reason}
- Errors: ${errors.slice(0, 3).join(', ')}

I'm operating in local mode for now. How can I help you?`,
      model: 'local-fallback',
      provider: 'local',
      isRealAI: false,
      metadata: {
        timing,
        servicesFound,
        errors: errors.slice(0, 5) // Ограничиваем количество ошибок
      }
    }
  }
}