import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

// Мок-провайдеры для локального тестирования
export const MOCK_PROVIDERS = [
  {
    provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    model: 'llama-3.3-70b-instruct',
    serviceType: 'inference',
    url: 'https://mock-llama-service.local',
    inputPrice: BigInt('1000000000000000'),
    outputPrice: BigInt('2000000000000000'),
    verifiability: 'TeeML',
    updatedAt: BigInt(Date.now())
  },
  {
    provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
    model: 'deepseek-r1-70b',
    serviceType: 'inference',
    url: 'https://mock-deepseek-service.local',
    inputPrice: BigInt('1000000000000000'),
    outputPrice: BigInt('2000000000000000'),
    verifiability: 'TeeML',
    updatedAt: BigInt(Date.now())
  }
]

// Мок-ответы для разных типов запросов
const MOCK_RESPONSES: Record<string, string[]> = {
  greeting: [
    "Hello! I'm your AI assistant. How can I help you today?",
    "Hi there! I'm ready to assist you. What would you like to know?",
    "Greetings! I'm here to help. Feel free to ask me anything."
  ],
  coding: [
    "I can help you with coding! What programming language or problem are you working with?",
    "I'd be happy to assist with your code. Please share the details of what you need help with.",
    "Sure, I can help with programming. What specific coding challenge are you facing?"
  ],
  general: [
    "That's an interesting question! Let me think about it and provide you with a helpful response.",
    "I understand your query. Here's what I can tell you about that topic...",
    "Great question! Based on my knowledge, here's what I can share..."
  ],
  default: [
    "I'm currently running in test mode with limited capabilities. However, I'm here to demonstrate the chat interface functionality.",
    "While I'm operating with mock services, I can still engage in conversation and show how the system works.",
    "I'm a test version of the AI assistant. Though my responses are simulated, the chat interface is fully functional!"
  ]
}

// Функция для генерации мок-ответа на основе запроса
export function generateMockResponse(message: string, agentName: string, agentDescription: string): string {
  const lowerMessage = message.toLowerCase()
  
  // Определяем тип запроса
  let responseType = 'default'
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    responseType = 'greeting'
  } else if (lowerMessage.includes('code') || lowerMessage.includes('program') || lowerMessage.includes('function')) {
    responseType = 'coding'
  } else if (lowerMessage.length > 10) {
    responseType = 'general'
  }
  
  // Выбираем случайный ответ из категории
  const responses = MOCK_RESPONSES[responseType]
  const baseResponse = responses[Math.floor(Math.random() * responses.length)]
  
  // Добавляем персонализацию на основе агента
  const personalizedResponse = `[${agentName}]: ${baseResponse}\n\n${agentDescription}`
  
  return personalizedResponse
}

// Мок-класс для эмуляции OpenAI API
export class MockOpenAI {
  private agentName: string
  private agentDescription: string
  
  constructor(agentName: string, agentDescription: string) {
    this.agentName = agentName
    this.agentDescription = agentDescription
  }
  
  async createCompletion(messages: ChatCompletionMessageParam[]): Promise<any> {
    // Симулируем задержку сети
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000))
    
    // Получаем последнее сообщение пользователя
    const userMessage = messages.filter(m => m.role === 'user').pop()
    const content = userMessage?.content || 'Hello'
    
    // Генерируем мок-ответ
    const response = generateMockResponse(
      typeof content === 'string' ? content : 'Hello',
      this.agentName,
      this.agentDescription
    )
    
    return {
      id: `chatcmpl-mock-${Date.now()}`,
      object: 'chat.completion',
      created: Date.now(),
      model: 'mock-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    }
  }
}

// Мок-брокер для тестирования
export class MockBroker {
  async getLedger() {
    return {
      balance: BigInt('100000000000000000'), // 0.1 OG
      locked: BigInt('0')
    }
  }
  
  async addLedger(amount: bigint) {
    console.log('[MockBroker] Adding ledger:', amount.toString())
    return true
  }
  
  async listService() {
    console.log('[MockBroker] Returning mock services')
    return MOCK_PROVIDERS
  }
  
  async acknowledgeProviderSigner(provider: string) {
    console.log('[MockBroker] Mock acknowledging provider:', provider)
    return { hash: `0xmock${Date.now()}` }
  }
  
  async getServiceMetadata(provider: string) {
    const service = MOCK_PROVIDERS.find(s => s.provider === provider)
    if (!service) throw new Error('Mock provider not found')
    
    return {
      endpoint: service.url,
      model: service.model
    }
  }
  
  async getRequestHeaders(provider: string, content: string) {
    return {
      'X-Mock-Auth': `mock-${Date.now()}`,
      'X-Provider': provider,
      'X-Content-Hash': Buffer.from(content).toString('base64').slice(0, 16)
    }
  }
  
  async processResponse(provider: string, content: string, chatId?: string) {
    console.log('[MockBroker] Processing mock response:', { provider, chatId })
    return true
  }
}

// Функция для определения, нужно ли использовать мок-сервисы
export function shouldUseMockServices(): boolean {
  // Используем мок-сервисы если:
  // 1. Установлена переменная окружения USE_MOCK_SERVICES
  // 2. Или мы в режиме разработки и не можем подключиться к реальным сервисам
  return process.env.USE_MOCK_SERVICES === 'true' || 
         (process.env.NODE_ENV === 'development' && process.env.FORCE_REAL_SERVICES !== 'true')
}