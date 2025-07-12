// lib/compute/client.ts - Обновленный для ethers v6
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
  private provider: ethers.JsonRpcProvider
  private signer: ethers.Wallet
  private acknowledgedProviders: Set<string> = new Set()
  
  constructor(privateKey: string) {
    const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    this.provider = new ethers.JsonRpcProvider(rpcUrl)
    this.signer = new ethers.Wallet(privateKey, provider)
  }
  
  // Инициализация broker
  async initialize() {
    try {
      this.broker = await createZGComputeNetworkBroker(this.signer)
      
      // Проверяем баланс ledger
      const accountInfo = await this.broker.ledger.getLedger()
      console.log('Ledger balance:', accountInfo)
      
      // Если баланса нет, добавляем начальный депозит
      if (!accountInfo || accountInfo[0] === '0') {
        console.log('Adding initial ledger balance...')
        await this.broker.ledger.addLedger(0.01) // 0.01 ETH
      }
    } catch (error) {
      console.error('Failed to initialize broker:', error)
      throw error
    }
  }
  
  // Получить список доступных сервисов
  async listServices() {
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
      throw new Error(`Failed to execute chat: ${error.message}`)
    }
  }
  
  // Streaming не поддерживается напрямую через broker
  async streamChat(request: ChatRequest): AsyncGenerator<string> {
    const response = await this.chat(request)
    
    // Эмулируем streaming, разбивая ответ на части
    const words = response.content.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  // Проверить баланс аккаунта
  async getAccountInfo() {
    try {
      const ledgerInfo = await this.broker.ledger.getLedger()
      return {
        balance: ledgerInfo ? ethers.formatEther(ledgerInfo[0]) : '0',
        rawBalance: ledgerInfo ? ledgerInfo[0].toString() : '0'
      }
    } catch (error) {
      console.error('Failed to get account info:', error)
      throw error
    }
  }
  
  // Пополнить баланс
  async deposit(amount: number) {
    try {
      await this.broker.ledger.depositFund(amount)
      console.log(`Deposited ${amount} ETH to ledger`)
    } catch (error) {
      console.error('Failed to deposit:', error)
      throw error
    }
  }
  
  // Запросить возврат средств
  async refund(amount: number) {
    try {
      await this.broker.ledger.requestRefund(amount)
      console.log(`Requested refund of ${amount} ETH`)
    } catch (error) {
      console.error('Failed to request refund:', error)
      throw error
    }
  }
}

// Создаем singleton instance
let computeInstance: ZeroGComputeClient | null = null

export async function getComputeClient(): Promise<ZeroGComputeClient> {
  if (!computeInstance) {
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY || ''
    if (!privateKey) {
      throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
    }
    
    computeInstance = new ZeroGComputeClient(privateKey)
    await computeInstance.initialize()
  }
  
  return computeInstance
}

// Экспортируем типы
export type { ChatMessage, ChatRequest, ChatResponse }