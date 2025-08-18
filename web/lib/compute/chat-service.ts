import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import {
  getComputeLedgerContract,
  getComputeInferenceContract,
  getFineTuningServingAddress
} from '@/lib/server/compute-env'
import { create0GRateLimitedProvider } from '@/lib/server/provider'

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

// Предпочитаемые официальные адреса провайдеров (Galileo)
const OFFICIAL_PROVIDER_ADDRESSES = new Set<string>([
  '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
  '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
])

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

      // 2. Дискавери сервисов через контракт + fallback на hardcoded провайдеры
      console.log('Discovering services from 0G Inference contract (Galileo)')
      const discoveryStart = Date.now()
      let services: any[] = []
      let contractServicesWorking = false
      
      try {
        // Add delay before service discovery to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))
        
        const listed = await broker.inference.listService()
        if (listed && Array.isArray(listed) && listed.length > 0) {
          services = listed
            .filter((s: any) => (s?.url && s?.provider))
            .map((s: any) => ({
              provider: s.provider,
              model: s.model,
              url: s.url,
              serviceType: s.serviceType,
              verifiability: s.verifiability
            }))
          
          if (services.length > 0) {
            contractServicesWorking = true
            console.log(`Contract service discovery found ${services.length} services`)
          }
        }
      } catch (e: any) {
        console.log('Contract service discovery failed:', e?.message)
        errors.push(`Contract discovery error: ${e?.message}`)
      }

      // Если нет сервисов из контракта, используем fallback на официальные провайдеры
      if (!contractServicesWorking) {
        console.log('No services from contract, using fallback official providers')
        
        // First try to check if providers exist in contract but without service metadata
        console.log('Checking if providers exist in contract directly...')
        const fallbackServices: any[] = []
        
        for (const providerAddr of Array.from(OFFICIAL_PROVIDER_ADDRESSES)) {
          try {
            // Try to get service metadata directly from contract
            await new Promise(resolve => setTimeout(resolve, 300)) // Rate limiting
            const metadata = await broker.inference.getServiceMetadata(providerAddr)
            console.log(`✅ Found provider ${providerAddr} via getServiceMetadata`)
            
            fallbackServices.push({
              provider: providerAddr,
              model: metadata.model || 'unknown',
              url: metadata.endpoint,
              serviceType: 'inference',
              verifiability: 'TeeML',
              isContractRegistered: true
            })
          } catch (metaError: any) {
            console.log(`Provider ${providerAddr} not found in contract: ${metaError.message}`)
            
            // For providers not in contract, do not add them to fallback services
            // This avoids trying non-existent endpoints
            console.log(`Skipping provider ${providerAddr} - not registered in contract`)
          }
        }
        
        services = fallbackServices
        
        if (services.length === 0) {
          console.log('⚠️  No providers found via contract or service metadata')
          errors.push('Contract has no registered services and providers are not available')
        } else {
          console.log(`Found ${services.length} providers (${services.filter(s => s.isContractRegistered).length} from contract, 0 static)`)
        }
      }

      // Предпочитаем официальные адреса
      services.sort((a, b) => {
        const aOfficial = OFFICIAL_PROVIDER_ADDRESSES.has((a.provider || '').toLowerCase())
        const bOfficial = OFFICIAL_PROVIDER_ADDRESSES.has((b.provider || '').toLowerCase())
        if (aOfficial === bOfficial) return 0
        return aOfficial ? -1 : 1
      })
      
      timing.discovery = Date.now() - discoveryStart

      if (!services.length) {
        errors.push('No services discovered and no fallback providers available')
        timing.totalTTFB = Date.now() - startTime
        return {
          success: false,
          response: 'No AI services available on the current network. Please try again later.',
          model: 'unavailable',
          provider: 'none',
          isRealAI: false,
          metadata: { timing, servicesFound: 0, errors }
        }
      }

      console.log(`Working with ${services.length} discovered providers`)

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
      errors.push('All providers failed to respond')
      
      return {
        success: false,
        response: 'Unable to connect to AI services. Please check your configuration and try again.',
        model: 'error',
        provider: 'none',
        isRealAI: false,
        metadata: { timing, servicesFound: services.length, errors }
      }

    } catch (error: any) {
      timing.totalTTFB = Date.now() - startTime
      errors.push(error.message)
      console.error('ChatService error:', error)
      
      return {
        success: false,
        response: `Service error: ${error.message}`,
        model: 'error',
        provider: 'none',
        isRealAI: false,
        metadata: { timing, servicesFound: 0, errors }
      }
    }
  }

  private async getBrokerSafe(): Promise<any> {
    const now = Date.now()
    
    // Check cache
    if (brokerCache && (now - brokerCache.timestamp) < BROKER_TTL) {
      console.log('Using cached broker')
      return brokerCache.broker
    }

    console.log('Initializing new broker...')
    
    try {
      // Use rate-limited provider to avoid RPC throttling
      const provider = create0GRateLimitedProvider()
      if (!this.privateKey) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      
      // Validate private key format
      const cleanKey = this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`
      if (!/^0x[a-fA-F0-9]{64}$/.test(cleanKey)) {
        throw new Error('Invalid private key format')
      }
      
      const wallet = new ethers.Wallet(cleanKey, provider)
      console.log(`Wallet address: ${wallet.address}`)
      
      // Test network connectivity with rate limiting
      try {
        if (wallet.provider) {
          // Add delay to avoid immediate rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
          const balance = await wallet.provider.getBalance(wallet.address)
          console.log(`Wallet balance: ${ethers.formatEther(balance)} OG`)
        }
      } catch (networkError: any) {
        console.log('Network check failed (non-critical):', networkError.message)
      }
      
      console.log('Creating broker with contracts:', {
        ledger: OFFICIAL_CONTRACTS.ledger,
        inference: OFFICIAL_CONTRACTS.inference,
        fineTuning: OFFICIAL_CONTRACTS.fineTuning
      })
      
      // Add delay before broker creation to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const broker = await createZGComputeNetworkBroker(
        wallet,
        OFFICIAL_CONTRACTS.ledger,
        OFFICIAL_CONTRACTS.inference,
        OFFICIAL_CONTRACTS.fineTuning
      )

      console.log('Broker created successfully')

      // Check and top up balance safely with delays
      await this.ensureMinBalance(broker)

      // Cache broker
      brokerCache = { broker, timestamp: now }
      
      return broker
    } catch (error: any) {
      console.error('Broker initialization failed:', error)
      throw new Error(`Failed to initialize broker: ${error.message}`)
    }
  }

  private async ensureMinBalance(broker: any): Promise<void> {
    try {
      // Add delay before balance check to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const ledgerInfo = await broker.ledger.getLedger()
      
      // Check if ledgerInfo and balance exist
      if (!ledgerInfo) {
        console.log('No ledger info found, creating account...')
        // Add delay before account creation
        await new Promise(resolve => setTimeout(resolve, 500))
        const initialAmount = ethers.parseEther('0.05')
        await broker.ledger.addLedger(initialAmount)
        console.log('New ledger account created with 0.05 OG')
        return
      }

      // Safely handle balance - check for null/undefined
      let balance = 0
      if (ledgerInfo.balance !== null && ledgerInfo.balance !== undefined) {
        balance = this.safeBigIntToNumber(ledgerInfo.balance)
        console.log(`Ledger balance: ${ethers.formatEther(ledgerInfo.balance)} OG`)
      } else {
        console.log('Ledger balance is null/undefined, treating as 0')
      }
      
      const minBalance = 0.02
      if (balance < minBalance) {
        console.log('Low balance, adding funds...')
        // Add delay before adding funds
        await new Promise(resolve => setTimeout(resolve, 500))
        const addAmount = ethers.parseEther('0.05')
        await broker.ledger.addLedger(addAmount)
        console.log('Funds added successfully')
      }
    } catch (error: any) {
      console.log('Balance check error (non-critical):', error.message)
      // Don't break on balance errors, continue with service discovery
    }
  }

  private safeBigIntToNumber(value: any): number {
    try {
      // Handle null and undefined values
      if (value === null || value === undefined) {
        console.log('BigInt conversion: value is null/undefined, returning 0')
        return 0
      }
      
      if (typeof value === 'bigint') {
        return Number(ethers.formatEther(value))
      }
      if (typeof value === 'string' && value !== '') {
        return Number(ethers.formatEther(BigInt(value)))
      }
      if (typeof value === 'number') {
        return Number(ethers.formatEther(BigInt(value)))
      }
      
      // Try to convert using toString() method
      const strValue = value?.toString?.()
      if (strValue && strValue !== '0' && strValue !== '') {
        return Number(ethers.formatEther(BigInt(strValue)))
      }
      
      console.log('BigInt conversion: falling back to 0 for value:', value)
      return 0
    } catch (error) {
      console.log('BigInt conversion error:', error)
      return 0
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

      // Получим актуальные метаданные сервиса из контракта
      let metadata: { endpoint: string; model: string }
      let isStaticMetadata = false
      
      // If this is a static fallback service, skip contract metadata lookup
      if (service.isStatic || !service.isContractRegistered) {
        console.log(`Using static fallback metadata for ${service.provider}`)
        metadata = { endpoint: service.url, model: service.model }
        isStaticMetadata = true
      } else {
        try {
          // Add delay before metadata request to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))
          
          const meta = await broker.inference.getServiceMetadata(service.provider)
          metadata = { endpoint: meta.endpoint, model: meta.model }
          console.log(`Service metadata from contract: ${metadata.endpoint}`)
        } catch (metaErr: any) {
          console.log(`Service metadata not available: ${metaErr?.message}`)
          
          // Проверяем специфичные ошибки сервиса
          if (metaErr?.message?.includes('ServiceNotExist')) {
            console.log(`Provider ${service.provider} failed: execution reverted: ServiceNotExist(address)`)
          }
          
          throw new Error(`No service metadata available for ${service.provider}: ${metaErr?.message}`)
        }
      }

      // Use the single endpoint from service metadata
      console.log(`Trying endpoint: ${metadata.endpoint}`)
      
      try {
        const result = await this.tryEndpoint(
          broker, 
          service, 
          request, 
          metadata,
          isStaticMetadata,
          controller
        )
        
        if (result) {
          console.log(`✅ Success with endpoint: ${metadata.endpoint}`)
          return result
        }
      } catch (endpointError: any) {
        console.log(`❌ Endpoint ${metadata.endpoint} failed: ${endpointError.message}`)
        throw endpointError
      }

    } catch (error: any) {
      console.log(`Provider ${service.provider} failed: ${error.message}`)
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private async tryEndpoint(
    broker: any,
    service: any,
    request: ChatRequest,
    metadata: { endpoint: string; model: string },
    isStaticMetadata: boolean,
    controller: AbortController
  ): Promise<any> {
    // Generate headers and send request
      let headers: any = {}
      try {
        // For static metadata, we skip header generation as services might not be registered
        if (isStaticMetadata) {
          console.log('Skipping header generation for static fallback service')
          headers = {
            'User-Agent': '0G-Chat-Client/1.0',
            'X-Provider': service.provider,
            'X-Model': service.model,
            'X-Fallback': 'true'
          }
        } else {
          // Add delay before header generation to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300))
          
          headers = await broker.inference.getRequestHeaders(service.provider, request.message)
          console.log('✅ Generated request headers successfully')
        }
      } catch (headerError: any) {
        console.log(`Header generation failed: ${headerError.message}`)
        
        // If header generation fails due to ServiceNotExist, try acknowledge first
        if (headerError.message.includes('ServiceNotExist') || 
            headerError.message.includes('acknowledge') || 
            headerError.message.includes('unauthorized')) {
          console.log('Attempting to acknowledge provider for header generation...')
          
          try {
            await this.acknowledgeProviderSafe(broker, service.provider)
            // Add delay before retry
            await new Promise(resolve => setTimeout(resolve, 500))
            // Retry header generation after acknowledge
            headers = await broker.inference.getRequestHeaders(service.provider, request.message)
            console.log('✅ Generated headers after acknowledge')
          } catch (retryError: any) {
            console.log(`Header generation still failed after acknowledge: ${retryError.message}`)
            
            // Fallback to minimal headers for static services
            if (isStaticMetadata) {
              console.log('Using fallback headers for static service')
              headers = {
                'User-Agent': '0G-Chat-Client/1.0',
                'X-Provider': service.provider,
                'X-Model': service.model,
                'X-Fallback': 'true'
              }
            } else {
              throw retryError
            }
          }
        } else {
          // For static services, use fallback headers
          if (isStaticMetadata) {
            console.log('Using fallback headers for static service due to other error')
            headers = {
              'User-Agent': '0G-Chat-Client/1.0',
              'X-Provider': service.provider,
              'X-Model': service.model,
              'X-Fallback': 'true'
            }
          } else {
            throw headerError
          }
        }
      }

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

      // Try OpenAI SDK first
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

        // Process response (verification)
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
        console.log(`OpenAI SDK failed: ${sdkError.message}`)
        
        // Fallback: direct fetch
        console.log('Trying direct fetch...')
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
  }

  private async acknowledgeProviderSafe(broker: any, providerAddress: string): Promise<void> {
    const now = Date.now()
    const lastAck = acknowledgeCache.get(providerAddress)

    if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
      console.log('Provider already acknowledged (cached)')
      return
    }

    // Add delay before acknowledge to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 400))

    const maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Acknowledging provider ${providerAddress}... (attempt ${attempt + 1}/${maxRetries})`)
        
        const ackTx = await broker.inference.acknowledgeProviderSigner(providerAddress)
        
        if (ackTx && (ackTx as any).hash) {
          console.log(`Acknowledge tx: ${(ackTx as any).hash}`)
          try {
            await (ackTx as any)?.wait?.()
            console.log('Acknowledge transaction confirmed')
          } catch (waitErr: any) {
            console.log('Ack wait error (non-critical):', waitErr?.message)
          }
        } else {
          console.log('Provider signer already acknowledged (no tx emitted)')
        }

        acknowledgeCache.set(providerAddress, now)
        console.log('Provider acknowledged successfully!')
        return
        
      } catch (ackError: any) {
        console.log('Acknowledge error details:', ackError.message)
        
        // Handle different error types
        if (ackError.message.includes('already acknowledged') || 
            ackError.message.includes('AlreadyAcknowledged')) {
          console.log('Provider already acknowledged')
          acknowledgeCache.set(providerAddress, now)
          return
        }
        
        // Handle rate limiting errors
        if (ackError.message.includes('rate exceeded') || 
            ackError.message.includes('Too many requests')) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Exponential backoff, max 5s
          console.log(`Rate limited, waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // For other errors on last attempt, throw
        if (attempt === maxRetries - 1) {
          console.log('Acknowledge failed but continuing:', ackError.message)
          throw ackError
        }
        
        // Wait before retry for other errors
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
}