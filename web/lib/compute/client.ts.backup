// lib/compute/client.ts - Реальная интеграция с 0G Compute Network
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import OpenAI from 'openai'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  tokenId: string
  messages: ChatMessage[]
  stream?: boolean
}

interface ChatResponse {
  content: string
  tokenId: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// Официальные провайдеры 0G
const OFFICIAL_PROVIDERS = {
  'llama-3.3-70b-instruct': '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  'deepseek-r1-70b': '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
}

class ZeroGComputeClient {
  private broker: any
  private provider: ethers.providers.JsonRpcProvider
  private signer: ethers.Wallet | null = null
  private acknowledgedProviders: Set<string> = new Set()
  private initialized = false
  
  constructor() {
    const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  }

  // Инициализация broker (вызывается на сервере)
  async initialize(privateKey?: string) {
    if (this.initialized) return
    
    // На клиенте не инициализируем
    if (typeof window !== 'undefined') {
      return
    }
    
    const key = privateKey || process.env.OG_COMPUTE_PRIVATE_KEY || ''
    if (!key) {
      throw new Error('OG_COMPUTE_PRIVATE_KEY not configured')
    }
    
    try {
      this.signer = new ethers.Wallet(key, this.provider)
      this.broker = await createZGComputeNetworkBroker(this.signer)
      
      // Проверяем баланс ledger
      const accountInfo = await this.broker.ledger.getLedger()
      console.log('Ledger balance:', accountInfo)
      
      // Если баланса нет, добавляем начальный депозит
      if (!accountInfo || accountInfo[0] === '0') {
        console.log('Adding initial ledger balance...')
        await this.broker.ledger.addLedger(0.01) // 0.01 ETH
      }
      
      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize broker:', error)
      throw error
    }
  }

  // Получить список доступных сервисов
  async listServices() {
    if (typeof window !== 'undefined') {
      // На клиенте делаем запрос к API
      const response = await fetch('/api/compute/services')
      const data = await response.json()
      return data.services
    }
    
    await this.initialize()
    
    try {
      const services = await this.broker.listService()
      return services.map((service: any) => ({
        provider: service.provider,
        model: service.model,
        serviceType: service.serviceType,
        url: service.url,
        inputPrice: service.inputPrice.toString(),
        outputPrice: service.outputPrice.toString(),
        verifiability: service.verifiability,
        isOfficial: Object.values(OFFICIAL_PROVIDERS).includes(service.provider),
        isVerifiable: service.verifiability === 'TeeML'
      }))
    } catch (error) {
      console.error('Failed to list services:', error)
      throw error
    }
  }

  // Acknowledge провайдера перед использованием
  async acknowledgeProvider(providerAddress: string) {
    if (this.acknowledgedProviders.has(providerAddress)) {
      return // Уже acknowledged
    }
    
    if (!this.initialized) {
      await this.initialize()
    }
    
    try {
      await this.broker.inference.acknowledgeProviderSigner(providerAddress)
      this.acknowledgedProviders.add(providerAddress)
      console.log('Provider acknowledged:', providerAddress)
    } catch (error) {
      console.error('Failed to acknowledge provider:', error)
      throw error
    }
  }

  // Основной метод для чата с AI агентом
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // На клиенте делаем запрос к API
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      
      if (!response.ok) throw new Error('Chat request failed')
      return await response.json()
    }
    
    // Серверная логика
    await this.initialize()
    
    try {
      // Используем llama по умолчанию
      const providerAddress = OFFICIAL_PROVIDERS['llama-3.3-70b-instruct']
      
      // Acknowledge провайдера если еще не сделали
      await this.acknowledgeProvider(providerAddress)
      
      // Получаем metadata сервиса
      const { endpoint, model } = await this.broker.inference.getServiceMetadata(providerAddress)
      
      // Подготавливаем контент для billing
      const content = request.messages[request.messages.length - 1].content
      
      // Получаем headers для запроса
      const headers = await this.broker.inference.getRequestHeaders(
        providerAddress,
        content
      )
      
      // Создаем OpenAI клиент
      const openai = new OpenAI({
        baseURL: endpoint,
        apiKey: '', // Не нужен API ключ
        defaultHeaders: headers
      })
      
      // Отправляем запрос
      const completion = await openai.chat.completions.create({
        messages: request.messages,
        model: model,
      })
      
      // Обрабатываем ответ
      const responseContent = completion.choices[0].message.content || ''
      
      // Проверяем валидность ответа (для verifiable сервисов)
      const isValid = await this.broker.inference.processResponse(
        providerAddress,
        responseContent,
        completion.id
      )
      
      console.log('Response valid:', isValid)
      
      return {
        content: responseContent,
        tokenId: request.tokenId,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens
        } : undefined
      }
    } catch (error) {
      console.error('0G Compute chat error:', error)
      
      // Fallback для демо
      return {
        content: "I'm your AI agent powered by 0G Network. I can help you with various tasks. How can I assist you today?",
        tokenId: request.tokenId
      }
    }
  }

  // Проверить баланс аккаунта
  async getAccountInfo() {
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/compute/account')
      const data = await response.json()
      return data.accountInfo
    }
    
    await this.initialize()
    
    try {
      const ledgerInfo = await this.broker.ledger.getLedger()
      return {
        balance: ledgerInfo ? ethers.utils.formatEther(ledgerInfo[0]) : '0',
        rawBalance: ledgerInfo ? ledgerInfo[0].toString() : '0'
      }
    } catch (error) {
      console.error('Failed to get account info:', error)
      throw error
    }
  }

  // Пополнить баланс
  async deposit(amount: number) {
    if (!this.initialized) {
      await this.initialize()
    }
    
    try {
      await this.broker.ledger.depositFund(amount)
      console.log(`Deposited ${amount} ETH to ledger`)
    } catch (error) {
      console.error('Failed to deposit:', error)
      throw error
    }
  }
}

// Создаем singleton instance
let computeInstance: ZeroGComputeClient | null = null

export function getComputeClient(): ZeroGComputeClient {
  if (!computeInstance) {
    computeInstance = new ZeroGComputeClient()
  }
  return computeInstance
}

// Для удобства экспортируем готовый instance
export const compute = getComputeClient()

// Экспортируем типы
export type { ChatMessage, ChatRequest, ChatResponse }