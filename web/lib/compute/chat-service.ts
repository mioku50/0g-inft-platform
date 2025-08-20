// lib/compute/chat-service.ts
import { ethers } from 'ethers'

interface ChatRequest {
  message: string
  agentMetadata: any
  broker: any
}

interface ChatResponse {
  success: boolean
  response: string
  model?: string
  provider?: string
  isRealAI: boolean
  ttfb?: number
  error?: string
}

class ChatService {
  async processChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now()

    try {
      const broker = request.broker

      // Check and create ledger if needed
      await this.ensureLedgerBalance(broker)

      // Discover services
      const services = await broker.inference.listService()
      console.log(`listService() -> [${services.length} services]`)

      if (services.length === 0) {
        return this.createGracefulFallback(request, 'No services available')
      }

      // Try each service
      for (const service of services) {
        try {
          console.log(`Trying service: ${service.model} at ${service.provider}`)
          
          // Get service metadata and endpoint
          const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
          console.log('Service endpoint:', endpoint)

          // Get request headers
          const headers = await broker.inference.getRequestHeaders(service.provider, request.message)
          console.log('Headers generated:', Object.keys(headers))

          // Acknowledge provider if needed
          await this.acknowledgeProviderIfNeeded(broker, service.provider)

          // Send inference request
          const response = await this.sendInferenceRequest({
            endpoint,
            model,
            headers,
            message: request.message,
            agentMetadata: request.agentMetadata
          })

          if (response.success) {
            // Process response if verifiable
            if (service.verifiability) {
              try {
                await broker.inference.processResponse(
                  service.provider,
                  response.content,
                  response.id || 'unknown'
                )
              } catch (e) {
                console.log('Process response error:', (e as any).message)
              }
            }

            const ttfb = Date.now() - startTime
            return {
              success: true,
              response: response.content,
              model,
              provider: service.provider,
              isRealAI: true,
              ttfb
            }
          }

        } catch (serviceError: any) {
          console.error(`Service ${service.model} error:`, serviceError.message)
          
          // If ServiceNotExist, try acknowledge once more
          if (serviceError.message?.includes('ServiceNotExist')) {
            try {
              await broker.inference.acknowledgeProviderSigner(service.provider)
              console.log('Acknowledged provider after ServiceNotExist error')
            } catch (ackError) {
              console.log('Final acknowledge attempt failed:', (ackError as any).message)
            }
          }
        }
      }

      // All services failed
      return this.createGracefulFallback(request, 'All services failed')

    } catch (error: any) {
      console.error('Chat service error:', error.message)
      return this.createGracefulFallback(request, error.message)
    }
  }

  private async ensureLedgerBalance(broker: any): Promise<void> {
    try {
      const info = await broker.ledger.getLedger()
      const balance = info?.balance ?? BigInt(0)
      
      console.log('Ledger balance:', ethers.formatEther(balance), 'OG')
      
      if (balance < ethers.parseEther('0.02')) {
        console.log('Low balance, adding funds...')
        await broker.ledger.addLedger(ethers.parseEther('0.05'))
        console.log('Funds added')
      }
    } catch (error: any) {
      if (!error.message?.includes('invalid BigNumberish value')) {
        console.log('Creating new ledger account...')
        try {
          await broker.ledger.addLedger(ethers.parseEther('0.05'))
          console.log('New ledger account created')
        } catch (createError) {
          console.error('Failed to create ledger:', (createError as any).message)
        }
      } else {
        console.error('Ledger balance check error:', error.message)
      }
    }
  }

  private async acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
    try {
      console.log('Acknowledging provider...')
      const ackTx = await broker.inference.acknowledgeProviderSigner(providerAddress)
      
      if (ackTx?.hash) {
        console.log('Acknowledge tx:', ackTx.hash)
        await ackTx.wait()
        console.log('Provider acknowledged successfully!')
      }
    } catch (ackError: any) {
      if (ackError.message?.includes('already acknowledged')) {
        console.log('Provider already acknowledged')
      } else if (ackError.message?.includes('ServiceNotExist')) {
        console.log('ServiceNotExist during acknowledge - skipping this provider')
        throw ackError
      } else {
        console.log('Acknowledge error:', ackError.message)
        // Continue anyway - some providers may work without acknowledge
      }
    }
  }

  private async sendInferenceRequest(params: {
    endpoint: string
    model: string
    headers: Record<string, string>
    message: string
    agentMetadata: any
  }): Promise<{ success: boolean; content: string; id?: string }> {
    const requestBody = {
      messages: [
        { 
          role: 'system', 
          content: `You are ${params.agentMetadata.name}. ${params.agentMetadata.description}` 
        },
        { role: 'user', content: params.message }
      ],
      model: params.model,
      stream: false
    }

    console.log('Sending request to AI...')

    const response = await fetch(`${params.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        ...params.headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format')
    }

    return {
      success: true,
      content: data.choices[0].message.content,
      id: data.id
    }
  }

  private createGracefulFallback(request: ChatRequest, reason: string): ChatResponse {
    const response = `Hello! I'm ${request.agentMetadata.name}. ${request.agentMetadata.description}

🔄 Status Update:
✅ SDK 0.3.1 initialized
⚠️ AI providers temporarily unavailable: ${reason}

I'm here with local intelligence while we reconnect to the 0G Compute network. What would you like to discuss?`

    return {
      success: true,
      response,
      model: 'local-fallback',
      provider: 'local',
      isRealAI: false
    }
  }
}

export const chatService = new ChatService()
