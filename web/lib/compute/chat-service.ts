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

      // Log the ackEligible providers for debugging
      console.log(`🔍 Found ${services.length} broker services, ackEligible: ${services.length}`)
      services.forEach((service, i) => {
        console.log(`  ${i + 1}. ${service.provider} (${service.model || 'unknown model'})`)
      })

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
    
    let brokerServices: any[] = []
    let envServices: any[] = []
    
    // 1. Try to get services from the broker
    try {
      const services = await broker.inference.listService()
      console.log(`🔍 [Discovery] Found ${services.length} services from broker`)
      brokerServices = services || []
    } catch (error: any) {
      console.error('❌ [Discovery] Broker service discovery failed:', error.message)
    }
    
    // 2. Parse providers from environment
    try {
      envServices = this.parseProvidersFromEnv()
      console.log(`🔍 [Discovery] Parsed ${envServices.length} providers from env`)
    } catch (error: any) {
      console.error('❌ [Discovery] Env provider parsing failed:', error.message)
    }
    
    // 3. Find ackEligible providers (exist in both broker and env)
    const brokerProviderAddresses = new Set(
      brokerServices.map(s => s.provider?.toLowerCase()).filter(Boolean)
    )
    
    const ackEligible = envServices.filter(envProvider => {
      return brokerProviderAddresses.has(envProvider.provider.toLowerCase())
    })
    
    console.log(`🔍 Found ${brokerServices.length} broker services, ${envServices.length} env services, ackEligible: ${ackEligible.length}`)
    
    // 4. If we have eligible providers, use them; otherwise fall back to env providers
    if (ackEligible.length > 0) {
      // Enrich env providers with broker metadata
      const enriched = ackEligible.map(envProvider => {
        const brokerService = brokerServices.find(
          bs => bs.provider?.toLowerCase() === envProvider.provider.toLowerCase()
        )
        return brokerService ? { ...brokerService, ...envProvider } : envProvider
      })
      
      console.log(`✅ [Discovery] Using ${enriched.length} ackEligible providers`)
      return this.prioritizeOfficialProviders(enriched)
    }
    
    // 5. Fallback: use env providers even if not found in broker
    if (envServices.length > 0) {
      console.log(`⚠️ [Discovery] No ackEligible providers found, using ${envServices.length} env providers as fallback`)
      return this.prioritizeOfficialProviders(envServices)
    }
    
    // 6. Last resort: use broker services if any
    if (brokerServices.length > 0) {
      console.log(`⚠️ [Discovery] No env providers, using ${brokerServices.length} broker services`)
      return this.prioritizeOfficialProviders(brokerServices)
    }
    
    console.log('❌ [Discovery] No services found from any source')
    return []
  }

  /**
   * Parse OG_PROVIDERS from environment variables
   * Supports both JSON array and CSV formats:
   * 
   * JSON: OG_PROVIDERS='[{"provider":"0xABC...","service":"0xSERVICE..."},{"provider":"0xDEF...","service":"0xSERVICE2..."}]'
   * CSV: OG_PROVIDERS=0xABC...:0xSERVICE...,0xDEF...:0xSERVICE2...
   * Simple: OG_PROVIDERS=0xABC...,0xDEF...
   */
  private parseProvidersFromEnv(): any[] {
    const envVar = process.env.OG_PROVIDERS || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || ''
    
    if (!envVar) {
      console.log('[Discovery] No OG_PROVIDERS found in env, using defaults')
      return [
        {
          provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
          url: 'https://compute-testnet.0g.ai',
          model: 'llama-3.3-70b-instruct',
          serviceType: 'inference',
          source: 'default'
        },
        {
          provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
          url: 'https://compute-testnet.0g.ai',
          model: 'deepseek-r1-70b',
          serviceType: 'inference',
          source: 'default'
        }
      ]
    }

    const trimmed = envVar.trim()
    
    // Try JSON format first
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          console.log('[Discovery] Parsed JSON format OG_PROVIDERS')
          return parsed.map((item: any) => ({
            provider: item.provider,
            service: item.service || 'inference',
            url: item.url || 'https://compute-testnet.0g.ai',
            model: item.model || 'unknown',
            serviceType: 'inference',
            source: 'env-json'
          }))
        }
      } catch (e: any) {
        console.warn('[Discovery] Failed to parse JSON format, trying CSV:', e.message)
      }
    }

    // CSV format: provider:service,provider:service or just provider,provider
    const providers: any[] = []
    const entries = trimmed.split(',').map(s => s.trim()).filter(Boolean)
    
    for (const entry of entries) {
      if (entry.includes(':')) {
        // Format: provider:service
        const [provider, service] = entry.split(':').map(s => s.trim())
        if (provider && service) {
          providers.push({
            provider,
            service,
            url: 'https://compute-testnet.0g.ai',
            model: 'unknown',
            serviceType: 'inference',
            source: 'env-csv-with-service'
          })
        }
      } else {
        // Format: just provider address
        if (entry.startsWith('0x') && entry.length >= 40) {
          providers.push({
            provider: entry,
            url: 'https://compute-testnet.0g.ai',
            model: 'unknown',
            serviceType: 'inference',
            source: 'env-csv-simple'
          })
        }
      }
    }

    console.log(`[Discovery] Parsed CSV format: ${providers.length} providers`)
    return providers
  }

  private prioritizeOfficialProviders(services: any[]): any[] {
    const officialProviders = [
      '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
      '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
    ]
    
    return services.sort((a: any, b: any) => {
      const aIsOfficial = officialProviders.includes(a.provider)
      const bIsOfficial = officialProviders.includes(b.provider)
      if (aIsOfficial && !bIsOfficial) return -1
      if (!aIsOfficial && bIsOfficial) return 1
      return 0
    })
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

    // Check if ACK_REQUIRED flag is set (default true for strict mode)
    const ackRequired = process.env.ACK_REQUIRED !== 'false'

    try {
      console.log('Acknowledging provider...')
      
      // Before acknowledging, optionally verify the service exists
      // This helps prevent ServiceNotExist errors
      if (ackRequired) {
        try {
          // Try to get service metadata as a pre-check
          const metadata = await broker.inference.getServiceMetadata(providerAddress)
          console.log(`Service metadata check passed for ${providerAddress}: ${metadata.model}`)
        } catch (metaError: any) {
          if (metaError.message.includes('ServiceNotExist')) {
            console.warn(`⚠️ Provider ${providerAddress} service does not exist, skipping acknowledge`)
            return // Skip this provider gracefully
          }
          // For other errors, proceed with acknowledge attempt
          console.warn(`Service metadata check failed (non-critical): ${metaError.message}`)
        }
      }
      
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
      const errorMsg = ackError.message || ackError.toString()
      
      if (errorMsg.includes('already acknowledged')) {
        console.log('Provider already acknowledged')
        acknowledgeCache.set(providerAddress, now)
      } else if (errorMsg.includes('ServiceNotExist')) {
        if (ackRequired) {
          console.error(`❌ ServiceNotExist error for ${providerAddress}`)
          throw new Error(`Service does not exist for provider ${providerAddress}`)
        } else {
          console.warn(`⚠️ ServiceNotExist for ${providerAddress}, but ACK_REQUIRED=false, skipping gracefully`)
          return // Skip this provider gracefully
        }
      } else {
        if (ackRequired) {
          throw new Error(`Acknowledge failed: ${errorMsg}`)
        } else {
          console.warn(`⚠️ Acknowledge failed for ${providerAddress}: ${errorMsg}, but ACK_REQUIRED=false, skipping`)
          return // Skip this provider gracefully
        }
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