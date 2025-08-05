/**
 * Non-Custodial Compute Client
 * 
 * This client now uses the client-side broker for direct provider communication.
 * Legacy API routes are still available for backwards compatibility.
 */

export interface ChatResponse {
  success: boolean
  response: string
  model?: string
  provider?: string
  isRealAI?: boolean
  verified?: boolean
}

export interface AnalysisResponse {
  success: boolean
  analysis?: any
  error?: string
}

export class ComputeClient {
  private baseUrl = '/api/compute'
  
  /**
   * Legacy chat method - now redirects to proxy
   * For new implementations, use useChat hook instead
   */
  async chat(message: string, agentMetadata: any): Promise<ChatResponse> {
    console.warn('[ComputeClient] Using legacy chat method. Consider using useChat hook for non-custodial mode.')
    
    try {
      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, agentMetadata })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Chat error:', error)
      return {
        success: false,
        response: 'Failed to connect to AI service. Please ensure your wallet is connected and you have a ledger account.'
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
