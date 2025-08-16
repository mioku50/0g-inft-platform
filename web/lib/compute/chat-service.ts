import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import {
  getComputeLedgerContract,
  getComputeInferenceContract,
  getFineTuningServingAddress
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

// Кэш брокера (TTL 5 минут)
interface BrokerCacheEntry {
  broker: any
  timestamp: number
}

let brokerCache: BrokerCacheEntry | null = null
const BROKER_TTL = 5 * 60 * 1000 // 5 минут

// Кэш acknowledge провайдеров (TTL 10 минут)
const acknowledgeCache = new Map<string, number>()
const ACKNOWLEDGE_TTL = 10 * 60 * 1000 // 10 минут

// Контракты из ENV
const OFFICIAL_CONTRACTS = {
  ledger: getComputeLedgerContract(),
  inference: getComputeInferenceContract(),
  fineTuning: getFineTuningServingAddress()
}

// Тайм-ауты
const TOTAL_TIMEOUT = 20000 // 20 секунд общий
const PROVIDER_TIMEOUT = 15000 // 15 секунд на провайдера

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
    // Enforce custodial mode
    const useCustodial = process.env.USE_NONCUSTODIAL_INFERENCE !== 'true'
    if (!useCustodial && typeof window !== 'undefined') {
      throw new Error('Non-custodial inference is disabled. Server-side only mode enforced.')
    }
    
    this.privateKey = privateKey
    
    if (!this.privateKey) {
      throw new Error('ChatService requires OG_COMPUTE_PRIVATE_KEY for custodial mode')
    }
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
      console.log('🚀 [ChatService] Starting custodial inference request...')
      
      // 1. Broker initialization with cache
      const brokerStart = Date.now()
      const broker = await this.getBrokerSafe()
      timing.initBroker = Date.now() - brokerStart

      // 2. Service discovery
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
    
    // Проверяем кэш
    if (brokerCache && (now - brokerCache.timestamp) < BROKER_TTL) {
      console.log('Using cached broker')
      return brokerCache.broker
    }

    console.log('Initializing new broker...')
    
    try {
      const provider = create0GProvider()
      if (!this.privateKey) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      const wallet = new ethers.Wallet(this.privateKey, provider)
      
      const broker = await createZGComputeNetworkBroker(
        wallet,
        OFFICIAL_CONTRACTS.ledger,
        OFFICIAL_CONTRACTS.inference,
        OFFICIAL_CONTRACTS.fineTuning
      )

      // Проверяем и пополняем баланс безопасно
      await this.ensureMinBalance(broker)

      // Кэшируем брокер
      brokerCache = { broker, timestamp: now }
      
      return broker
    } catch (error: any) {
      throw new Error(`Failed to initialize broker: ${error.message}`)
    }
  }

  private async ensureMinBalance(broker: any): Promise<void> {
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      
      // Use safe balance parsing to handle null/undefined values
      let balance = 0
      try {
        if (ledgerInfo && ledgerInfo.balance !== null && ledgerInfo.balance !== undefined) {
          balance = Number(ethers.formatEther(ledgerInfo.balance))
        } else {
          console.warn('Ledger balance is null/undefined, assuming 0')
        }
      } catch (e: any) {
        console.warn('Balance parsing error (non-critical):', e.message)
        balance = 0
      }
      
      const minBalance = 0.02
      
      console.log(`Ledger balance: ${balance} OG`)
      
      if (balance < minBalance) {
        console.log('Low balance, adding funds...')
        const addAmount = ethers.parseEther('0.05')
        await broker.ledger.addLedger(addAmount)
        console.log('Funds added successfully')
      }
    } catch (error: any) {
      console.log('Balance check error (non-critical):', error.message)
      // Don't interrupt service on balance errors
    }
  }

  private safeBigIntToNumber(value: any): number {
    try {
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return 0
      }
      
      // Handle string null/undefined
      if (typeof value === 'string' && (value === 'null' || value === 'undefined' || value === '')) {
        return 0
      }
      
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
    console.log('🔍 [Discovery] Starting provider discovery...')
    
    try {
      // Try to get services from the broker
      const services = await broker.inference.listService()
      console.log(`🔍 [Discovery] Found ${services.length} services from broker`)
      
      // If no services found via broker, try fallback providers from env
      if (services.length === 0) {
        console.log('🔍 [Discovery] No services from broker, trying env fallback...')
        return this.getFallbackProviders()
      }
      
      // Filter and validate services
      const validServices = []
      for (const service of services) {
        try {
          // Basic validation
          if (service.provider && service.url) {
            console.log(`✅ [Discovery] Valid service: ${service.provider} -> ${service.url}`)
            validServices.push(service)
          } else {
            console.warn(`⚠️ [Discovery] Invalid service missing provider/url:`, service)
          }
        } catch (e: any) {
          console.warn(`⚠️ [Discovery] Error validating service:`, e.message)
        }
      }
      
      if (validServices.length === 0) {
        console.log('🔍 [Discovery] No valid services found, using fallback providers')
        return this.getFallbackProviders()
      }
      
      // Prioritize official providers
      const officialProviders = [
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
        '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
      ]
      
      const sorted = validServices.sort((a: any, b: any) => {
        const aIsOfficial = officialProviders.includes(a.provider)
        const bIsOfficial = officialProviders.includes(b.provider)
        if (aIsOfficial && !bIsOfficial) return -1
        if (!aIsOfficial && bIsOfficial) return 1
        return 0
      })
      
      console.log(`✅ [Discovery] Returning ${sorted.length} validated services`)
      return sorted
      
    } catch (error: any) {
      console.error('❌ [Discovery] Service discovery failed:', error.message)
      console.log('🔍 [Discovery] Falling back to env providers')
      return this.getFallbackProviders()
    }
  }

  private getFallbackProviders(): any[] {
    // Get providers from environment as fallback
    const envProviders = (process.env.OG_PROVIDERS ?? process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    
    if (envProviders.length === 0) {
      // Use default provider from env
      const defaultProvider = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
      envProviders.push(defaultProvider)
    }
    
    console.log(`🔍 [Discovery] Using ${envProviders.length} fallback providers:`, envProviders)
    
    return envProviders.map((provider, index) => ({
      provider,
      url: `https://compute-testnet.0g.ai`, // Default 0G compute URL
      models: ['llama-3.3-70b-instruct'],
      pricePerToken: '1000000',
      index
    }))
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
    const lastAck = acknowledgeCache.get(providerAddress)

    if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
      console.log('Provider already acknowledged (cached)')
      return
    }

    try {
      console.log('Acknowledging provider...')
      const ackTx = await broker.inference.acknowledgeProviderSigner(providerAddress)
      if (ackTx && (ackTx as any).hash) {
        console.log(`Acknowledge tx: ${(ackTx as any).hash}`)
        try {
          await (ackTx as any)?.wait?.()
        } catch (waitErr: any) {
          console.log('Ack wait error (non-critical):', waitErr?.message)
        }
      } else {
        console.log('Provider signer already acknowledged (no tx emitted)')
      }

      acknowledgeCache.set(providerAddress, now)
      console.log('Provider acknowledged successfully!')
      
    } catch (ackError: any) {
      if (ackError.message.includes('already acknowledged')) {
        console.log('Provider already acknowledged')
        acknowledgeCache.set(providerAddress, now)
      } else {
        throw new Error(`Acknowledge failed: ${ackError.message}`)
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