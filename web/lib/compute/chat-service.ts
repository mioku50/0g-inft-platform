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

// Официальные провайдеры 0G для Galileo testnet
const OFFICIAL_PROVIDERS = [
  {
    address: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    model: 'llama-3.3-70b-instruct',
    url: 'https://serving-broker-1.0g-newton-testnet-sepolia.0g.ai',
    description: 'State-of-the-art 70B parameter model'
  },
  {
    address: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
    model: 'deepseek-r1-70b',
    url: 'https://serving-broker-2.0g-newton-testnet-sepolia.0g.ai',
    description: 'Advanced reasoning model'
  }
]

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

      // 2. Попробуем работать напрямую с известными провайдерами
      console.log('Using known official providers for Galileo testnet')
      const services = OFFICIAL_PROVIDERS.map(p => ({
        provider: p.address,
        model: p.model,
        url: p.url,
        serviceType: 'inference',
        verifiability: 'TeeML'
      }))

      console.log(`Working with ${services.length} official providers`)

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
      const provider = create0GProvider()
      if (!this.privateKey) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      
      // Validate private key format
      const cleanKey = this.privateKey.startsWith('0x') ? this.privateKey : `0x${this.privateKey}`
      if (!/^0x[a-fA-F0-9]{64}$/.test(cleanKey)) {
        throw new Error('Invalid private key format')
      }
      
      const wallet = new ethers.Wallet(cleanKey, provider)
      console.log(`Wallet address: ${wallet.address}`)
      
      // Test network connectivity
      try {
        if (wallet.provider) {
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
      
      const broker = await createZGComputeNetworkBroker(
        wallet,
        OFFICIAL_CONTRACTS.ledger,
        OFFICIAL_CONTRACTS.inference,
        OFFICIAL_CONTRACTS.fineTuning
      )

      console.log('Broker created successfully')

      // Check and top up balance safely
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
      const ledgerInfo = await broker.ledger.getLedger()
      
      // Check if ledgerInfo and balance exist
      if (!ledgerInfo) {
        console.log('No ledger info found, creating account...')
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

      // 1. Get service metadata - для официальных провайдеров используем известные URL
      const metadata = {
        endpoint: service.url,
        model: service.model
      }
      console.log(`Service endpoint: ${metadata.endpoint}`)

      // 2. Try direct request without acknowledgment first
      try {
        // Generate headers
        const headers = await broker.inference.getRequestHeaders(service.provider, request.message)

        // Prepare request
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
          
          // If it's an auth error, try to acknowledge
          if (sdkError.message.includes('acknowledge') || sdkError.message.includes('unauthorized')) {
            console.log('Attempting to acknowledge provider...')
            const ackStart = Date.now()
            try {
              await this.acknowledgeProviderSafe(broker, service.provider)
              timing.ack += Date.now() - ackStart
              
              // Retry after acknowledgment
              const newHeaders = await broker.inference.getRequestHeaders(service.provider, request.message)
              const openai = new OpenAI({
                baseURL: metadata.endpoint,
                apiKey: ''
              })

              const completion = await openai.chat.completions.create(requestBody, {
                headers: newHeaders,
                signal: controller.signal
              })

              const aiResponse = completion.choices[0].message.content
              
              return {
                response: aiResponse,
                model: metadata.model,
                provider: service.provider
              }
            } catch (retryError: any) {
              console.log('Retry after acknowledge failed:', retryError.message)
              throw retryError
            }
          }
          
          // For other errors, try direct fetch
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
      } catch (error: any) {
        console.log(`Direct request failed: ${error.message}`)
        throw error
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
      console.log(`Acknowledging provider ${providerAddress}...`)
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
      
    } catch (ackError: any) {
      console.log('Acknowledge error details:', ackError.message)
      
      // Handle different error types
      if (ackError.message.includes('already acknowledged') || 
          ackError.message.includes('AlreadyAcknowledged')) {
        console.log('Provider already acknowledged')
        acknowledgeCache.set(providerAddress, now)
        return
      }
      
      // For other errors, still try to continue
      console.log('Acknowledge failed but continuing:', ackError.message)
      throw ackError
    }
  }
}