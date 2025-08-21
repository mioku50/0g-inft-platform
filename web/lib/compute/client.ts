// Клиентский API для взаимодействия с 0G Compute
// НЕ импортируем серверные библиотеки здесь!

export interface ChatResponse {
  success: boolean
  response: string
  model?: string
  provider?: string
  isRealAI?: boolean
}

export interface AnalysisResponse {
  success: boolean
  analysis?: any
  error?: string
}

export class ComputeClient {
  private baseUrl = '/api/compute'
  
  async chat(message: string | { tokenId?: string | number; messages?: any[]; stream?: boolean }, agentMetadata?: any): Promise<ChatResponse> {
    try {
      // Support both legacy (message string + metadata) and object payload from pages
      const isObjectPayload = typeof message === 'object' && message !== null && !Array.isArray(message)
      const body = isObjectPayload
        ? { message: (message as any).messages?.at?.(-1)?.content || '', agentMetadata, agentId: (message as any).tokenId }
        : { message, agentMetadata }
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Chat error:', error)
      return {
        success: false,
        response: 'Failed to connect to AI service'
      }
    }
  }
  
  async analyzePrompt(prompt: string): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      
      return await response.json()
    } catch (error) {
      return {
        success: false,
        error: 'Analysis failed'
      }
    }
  }
  
  async generatePrompt(params: {
    description: string
    capabilities: string[]
    personality: string
  }): Promise<{ success: boolean; prompt?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })
      
      return await response.json()
    } catch (error) {
      return { success: false }
    }
  }
  
  async analyze(content: string, type: string, agentMetadata?: any) {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type, agentMetadata })
      })
      
      return await response.json()
    } catch (error) {
      return { success: false, error: 'Analysis failed' }
    }
  }
}

// Экспортируем singleton для удобства
export const computeClient = new ComputeClient()
