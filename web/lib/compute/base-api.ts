// web/lib/compute/base-api.ts
export class OGComputeAPI {
  private baseURL: string

  constructor(baseURL: string = 'https://compute-testnet.0g.ai') {
    this.baseURL = baseURL
  }

  // Проверка доступных endpoints
  async discoverEndpoints() {
    const endpoints = [
      '/health',
      '/status',
      '/api/v1/status',
      '/api/v1/providers',
      '/api/v1/services',
      '/api/v1/models',
      '/api/v1/inference',
      '/providers',
      '/services',
      '/models',
      '/ledger/info',
      '/compute/info'
    ]

    const results = []
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        results.push({
          endpoint,
          status: response.status,
          ok: response.ok,
          data: response.ok ? await response.json().catch(() => null) : null
        })
      } catch (error) {
        results.push({
          endpoint,
          status: 'error',
          ok: false,
          error: (error as any).message
        })
      }
    }
    
    return results
  }

  // Получение информации о сервисе
  async getServiceInfo() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/info`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Failed to get service info:', error)
    }
    return null
  }

  // Получение списка провайдеров через базовый API
  async getProviders() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/providers`)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      console.error('Failed to get providers:', error)
    }
    return null
  }

  // Попытка прямого inference через базовый API
  async inference(params: {
    model?: string
    prompt: string
    provider?: string
  }) {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })
      
      if (response.ok) {
        return await response.json()
      }
      
      throw new Error(`Inference failed: ${response.status}`)
    } catch (error) {
      console.error('Inference error:', error)
      throw error
    }
  }
}