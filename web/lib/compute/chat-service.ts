import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'
import { getBroker, ledgerSafe } from './broker'

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

// Официальные контракты
const OFFICIAL_CONTRACTS = {
  ledger: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  inference: '0x5299bd255B76305ae08d7F95D54',
  fineTuning: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176'
}

// Тайм-ауты
const TOTAL_TIMEOUT = 20000 // 20 секунд общий
const PROVIDER_TIMEOUT = 15000 // 15 секунд на провайдера

interface ChatRequest {
  message: string
  agentMetadata: {
    name: string
    description: string
  }
}

interface ChatResponse {
  response: string
  model: string
  provider: string
  isRealAI: boolean
  metadata: {
    timing: {
      initBroker: number
      discovery: number
      ack: number
      providerRequest: number
      totalTTFB: number
    }
    providers?: {
      found: number
      attempted: number
      successful: number
    }
  }
}

export class ChatService {
  private rpcUrl: string
  private privateKey: string

  constructor(rpcUrl: string, privateKey: string) {
    this.rpcUrl = rpcUrl
    this.privateKey = privateKey
  }

  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now()
    const timing = {
      initBroker: 0,
      discovery: 0,
      ack: 0,
      providerRequest: 0,
      totalTTFB: 0
    }

    try {
      // 1. Инициализация брокера (с кэшем)
      const brokerStart = Date.now()
      const broker = await this.getBrokerCached()
      timing.initBroker = Date.now() - brokerStart

      // 2. Обнаружение сервисов
      const discoveryStart = Date.now()
      const services = await this.discoverServices(broker)
      timing.discovery = Date.now() - discoveryStart

      if (services.length === 0) {
        throw new Error('No inference services found')
      }

      // 3. Acknowledge провайдеров
      const ackStart = Date.now()
      await this.acknowledgeProviders(broker, services)
      timing.ack = Date.now() - ackStart

      // 4. Параллельные запросы к провайдерам
      const providerStart = Date.now()
      const result = await this.requestFromProviders(broker, services, request)
      timing.providerRequest = Date.now() - providerStart

      timing.totalTTFB = Date.now() - startTime

      return {
        response: result.response,
        model: result.model,
        provider: result.provider,
        isRealAI: true,
        metadata: {
          timing,
          providers: {
            found: services.length,
            attempted: services.length,
            successful: 1
          }
        }
      }

    } catch (error: any) {
      console.error('ChatService error:', error)
      timing.totalTTFB = Date.now() - startTime

      return this.createFallbackResponse(error.message, timing)
    }
  }

  private async getBrokerCached() {
    const now = Date.now()
    
    // Проверяем кэш
    if (brokerCache && (now - brokerCache.timestamp) < BROKER_TTL) {
      console.log('Using cached broker')
      return brokerCache.broker
    }

    console.log('Initializing new broker...')
    const broker = await getBroker()
    
    brokerCache = {
      broker,
      timestamp: now
    }

    return broker
  }

  private async discoverServices(broker: any): Promise<any[]> {
    try {
      const services = await broker.inference.listService()
      
      console.log(`Found ${services.length} inference services`)
      
      // Приоритет официальным провайдерам
      const officialServices = services.filter((s: any) => 
        Object.values(OFFICIAL_CONTRACTS).includes(s.provider)
      )
      
      const otherServices = services.filter((s: any) => 
        !Object.values(OFFICIAL_CONTRACTS).includes(s.provider)
      )
      
      return [...officialServices, ...otherServices]
      
    } catch (error: any) {
      throw new Error(`Service discovery failed: ${error.message}`)
    }
  }

  private async acknowledgeProviders(broker: any, services: any[]): Promise<void> {
    const now = Date.now()
    
    for (const service of services) {
      const cacheKey = service.provider
      const lastAck = acknowledgeCache.get(cacheKey)
      
      if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
        console.log(`Provider ${service.provider} already acknowledged (cached)`)
        continue
      }

      try {
        await broker.inference.acknowledgeProviderSigner(service.provider)
        acknowledgeCache.set(cacheKey, now)
        console.log(`Acknowledged provider: ${service.provider}`)
      } catch (error: any) {
        console.warn(`Failed to acknowledge provider ${service.provider}:`, error.message)
      }
    }
  }

  private async requestFromProviders(broker: any, services: any[], request: ChatRequest): Promise<{ response: string; model: string; provider: string }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TOTAL_TIMEOUT)

    try {
      const promises = services.map(service => 
        this.requestFromProvider(broker, service, request, controller.signal)
      )

      const result = await Promise.any(promises)
      clearTimeout(timeoutId)
      return result

    } catch (error: any) {
      clearTimeout(timeoutId)
      throw new Error(`All providers failed: ${error.message}`)
    }
  }

  private async requestFromProvider(broker: any, service: any, request: ChatRequest, signal: AbortSignal): Promise<{ response: string; model: string; provider: string }> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT)

    try {
      // Пробуем OpenAI SDK
      const openai = new OpenAI({
        baseURL: service.url,
        apiKey: 'dummy-key'
      })

      const requestBody = {
        messages: [
          {
            role: 'system' as const,
            content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}`
          },
          { role: 'user' as const, content: request.message }
        ],
        model: service.model || 'default',
        stream: false as const
      }

      const response = await openai.chat.completions.create(requestBody, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const content = response.choices[0]?.message?.content || 'No response'

      // Если сервис верифицируемый - вызываем processResponse
      if (service.verifiable) {
        try {
          await broker.inference.processResponse(service.provider, response)
        } catch (verifyError: any) {
          console.warn(`Response verification failed for ${service.provider}:`, verifyError.message)
        }
      }

      return {
        response: content,
        model: service.model || 'unknown',
        provider: service.provider
      }

    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error(`Provider ${service.provider} timed out`)
      }
      
      // Fallback на fetch
      try {
        const response = await fetch(`${service.url}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer dummy-key'
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}` },
              { role: 'user', content: request.message }
            ],
            model: service.model || 'default'
          }),
          signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || 'No response'

        return {
          response: content,
          model: service.model || 'unknown',
          provider: service.provider
        }

      } catch (fetchError: any) {
        throw new Error(`Provider ${service.provider} failed: ${fetchError.message}`)
      }
    }
  }

  private createFallbackResponse(error: string, timing: any): ChatResponse {
    return {
      response: `I apologize, but I'm currently unable to connect to the 0G Compute network. This might be due to network issues or service maintenance. 

Error details: ${error}

Please try again in a few moments. If the issue persists, you can check the 0G Network status or contact support.`,
      model: 'local-fallback',
      provider: 'local',
      isRealAI: false,
      metadata: {
        timing,
        providers: {
          found: 0,
          attempted: 0,
          successful: 0
        }
      }
    }
  }
}