import { ethers } from 'ethers'
import OpenAI from 'openai'
import { getPrivateKey } from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

// Официальные провайдеры 0G
const PROVIDERS = [
  {
    name: 'gpt-4',
    url: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || ''
  }
]

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

    // Попробуем каждого провайдера по очереди
    for (const provider of PROVIDERS) {
      try {
        console.log(`Trying fallback provider: ${provider.name} at ${provider.url}`)
        
        const openai = new OpenAI({
          baseURL: provider.url,
          apiKey: provider.apiKey || 'dummy-key'
        })

        const messages = [
          { 
            role: 'system' as const, 
            content: `You are ${request.agentMetadata.name}. ${request.agentMetadata.description}` 
          },
          { 
            role: 'user' as const, 
            content: request.message 
          }
        ]

        // Определяем модель в зависимости от провайдера
        const model = provider.name.includes('gpt') ? 'gpt-3.5-turbo' : provider.name

        const completion = await openai.chat.completions.create({
          messages,
          model,
          max_tokens: 500,
          temperature: 0.7
        })

        const response = completion.choices[0].message.content || ''

        return {
          success: true,
          response,
          model,
          provider: provider.url,
          isRealAI: true,
          metadata: {
            timing: {
              totalTTFB: Date.now() - startTime
            }
          }
        }
      } catch (error: any) {
        console.error(`Provider ${provider.name} failed:`, error.message)
        errors.push(`${provider.name}: ${error.message}`)
        continue
      }
    }

    // Если все провайдеры не работают, используем простой fallback
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