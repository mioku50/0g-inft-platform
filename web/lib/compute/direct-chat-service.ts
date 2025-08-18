import { ethers } from 'ethers'
import OpenAI from 'openai'
import { getPrivateKey } from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

// Официальные провайдеры 0G (Galileo)
const OFFICIAL_PROVIDER_ADDRESSES = [
  '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
  '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
]

// Резервное сопоставление адресов провайдеров с их публичными URL, если контракт недоступен
function getProviderUrl(providerAddress: string): string {
  const map: Record<string, string> = {
    '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f': 'http://50.145.48.68:30080',
    '0xf07240Efa67755B5311bc75784a061eDB47165Dd': 'http://50.145.48.68:30080',
    '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3': 'http://50.145.48.68:30080'
  }
  return map[providerAddress] || 'http://50.145.48.68:30080'
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
    timing: {
      totalTTFB: number
    }
    errors?: string[]
  }
}

export class DirectChatService {
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Инициализируем брокер для генерации одноразовых заголовков
      const provider = create0GProvider()
      const pk = getPrivateKey()
      if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
      const wallet = new ethers.Wallet(pk, provider)
      const broker = await createZGComputeNetworkBroker(wallet)

      // Перебираем официальных провайдеров, даже если listService недоступен
      for (const providerAddress of OFFICIAL_PROVIDER_ADDRESSES) {
        try {
          // Получаем метаданные сервиса из контракта; 
          // если не удается — используем локальную карту URL и модель по умолчанию
          let endpoint: string
          let model: string
          try {
            const meta = await broker.inference.getServiceMetadata(providerAddress)
            endpoint = meta.endpoint
            model = meta.model
          } catch (metaErr: any) {
            console.log('Direct fallback: metadata not available, using static mapping:', metaErr?.message)
            endpoint = getProviderUrl(providerAddress)
            // Подберем разумную модель на основе адреса
            model = providerAddress.toLowerCase() === OFFICIAL_PROVIDER_ADDRESSES[0].toLowerCase()
              ? 'llama-3.3-70b-instruct'
              : 'deepseek-r1-70b'
          }

          const headers = await broker.inference.getRequestHeaders(providerAddress, request.message)

          const requestBody = {
            messages: [
              {
                role: 'system' as const,
                content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}`
              },
              { role: 'user' as const, content: request.message }
            ],
            model,
            stream: false as const
          }

          // OpenAI совместимый вызов к самому провайдеру 0G (НЕ api.openai.com)
          try {
            const openai = new OpenAI({ baseURL: endpoint, apiKey: '' })
            const completion = await openai.chat.completions.create(requestBody, { headers })
            const aiResponse = completion.choices[0].message.content || ''

            try {
              await broker.inference.processResponse(providerAddress, aiResponse, completion.id)
            } catch (verifyErr: any) {
              console.log('Direct fallback: processResponse warning:', verifyErr?.message)
            }

            return {
              success: true,
              response: aiResponse,
              model,
              provider: providerAddress,
              isRealAI: true,
              metadata: { timing: { totalTTFB: Date.now() - startTime } }
            }
          } catch (sdkError: any) {
            console.error(`Direct fallback: provider ${providerAddress} SDK error:`, sdkError.message)
            // Пробуем прямой fetch, если SDK по какой-то причине не сработал
            const resp = await fetch(`${endpoint}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify(requestBody)
            })
            if (!resp.ok) {
              throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
            }
            const data = await resp.json()
            const aiResponse = data.choices?.[0]?.message?.content || ''

            try {
              await broker.inference.processResponse(providerAddress, aiResponse, data.id)
            } catch (verifyErr: any) {
              console.log('Direct fallback: processResponse warning (fetch):', verifyErr?.message)
            }

            return {
              success: true,
              response: aiResponse,
              model,
              provider: providerAddress,
              isRealAI: true,
              metadata: { timing: { totalTTFB: Date.now() - startTime } }
            }
          }
        } catch (err: any) {
          console.error(`Direct fallback: provider ${providerAddress} failed:`, err.message)
          errors.push(`${providerAddress}: ${err.message}`)
          // Переходим к следующему провайдеру
          continue
        }
      }
    } catch (outerErr: any) {
      console.error('Direct fallback init error:', outerErr.message)
      errors.push(outerErr.message)
    }

    // Если все провайдеры не работают, используем локальный дефолтный ответ
    return {
      success: true,
      response: this.generateFallbackResponse(request.message, request.agentMetadata),
      model: 'fallback',
      provider: 'local',
      isRealAI: false,
      metadata: {
        timing: {
          totalTTFB: Date.now() - startTime
        },
        errors
      }
    }
  }

  private generateFallbackResponse(message: string, agentMetadata: any): string {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Hello! I'm ${agentMetadata.name}. ${agentMetadata.description} How can I help you today?`
    }
    
    if (lowerMessage.includes('help')) {
      return `I'm here to assist you. As ${agentMetadata.name}, I can help with various tasks. ${agentMetadata.description} What would you like to know?`
    }
    
    if (lowerMessage.includes('who are you')) {
      return `I am ${agentMetadata.name}. ${agentMetadata.description}`
    }
    
    // Default response
    return `I understand you said: "${message}". As ${agentMetadata.name}, I'm here to help. ${agentMetadata.description} Could you please provide more details about what you need?`
  }
}