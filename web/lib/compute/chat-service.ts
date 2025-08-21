// lib/compute/chat-service.ts
import { ethers } from 'ethers'

const ackCache = new Set<string>()

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

      // Discover services first
      let services = await broker.inference.listService()
      console.log(`services=${services.length}`)

      // Prefer official providers (best-effort heuristics)
      const providers = Array.from(services || [])
        .slice()
        .sort((a: any, b: any) => {
          const aInfo = String(a?.additionalInfo || a?.verifiability || '').toLowerCase()
          const bInfo = String(b?.additionalInfo || b?.verifiability || '').toLowerCase()
          const aScore = (aInfo.includes('official') || aInfo.includes('0g') || aInfo.includes('tee')) ? 1 : 0
          const bScore = (bInfo.includes('official') || bInfo.includes('0g') || bInfo.includes('tee')) ? 1 : 0
          return bScore - aScore
        })

      // Check and create/deposit ledger if needed
      await this.ensureLedgerBalance(broker)

      if (providers.length === 0) {
        return this.createGracefulFallback(request, 'No services available')
      }

      // Try each service
      for (const service of providers) {
        try {
          console.log(`try provider=${service.provider}`)
          
          // Acknowledge provider if needed (after ensuring available > 0)
          await this.acknowledgeProviderIfNeeded(broker, service.provider)

          // Get service metadata and endpoint
          const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
          console.log('metadata=OK', { model, provider: service.provider })

          // Get request headers
          const headers = await broker.inference.getRequestHeaders(service.provider, request.message)
          console.log('headers=OK')

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
            console.log(`provider=${service.provider} -> OK (${ttfb}ms)`)            
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
          const msg = serviceError?.message || ''
          const code = msg.includes('timeout>15s')
            ? 'timeout>15s'
            : msg.includes('Invalid response format')
              ? 'invalid-format'
              : (msg.match(/HTTP\s+(\d+)/)?.[1] || 'error')
          console.warn(`provider=${service.provider} -> ${code}`)
          
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
      const available = info?.availableBalance ?? 0n
      const total = info?.totalBalance ?? 0n

      console.log(`available=${Number(ethers.formatEther(available)).toFixed(4)} OG`)

      if (available === 0n) {
        // If account exists but available == 0 → create via addLedger(0.05)
        try {
          await broker.ledger.addLedger(0.05)
          const after = await broker.ledger.getLedger()
          console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
        } catch (e: any) {
          // If addLedger fails (already exists), attempt deposit
          await broker.ledger.depositFund(0.05)
          const after = await broker.ledger.getLedger()
          console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
        }
      } else {
        // If account exists but low balance < 0.01 → deposit
        const availableFloat = Number(ethers.formatEther(available))
        if (availableFloat < 0.01) {
          await broker.ledger.depositFund(0.05)
          const after = await broker.ledger.getLedger()
          console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
        }
      }
    } catch (error: any) {
      // If getLedger failed (e.g., Account does not exist) → create account
      const msg: string = error?.message || ''
      if (msg.includes('Account does not exist') || msg.includes('not exist')) {
        await broker.ledger.addLedger(0.05)
        const after = await broker.ledger.getLedger().catch(() => null)
        if (after) {
          console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
        }
      } else {
        console.error('Failed to ensure ledger balance:', msg)
        throw error
      }
    }
  }

  private async acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
    const walletAddr: string | undefined = (broker as any).__walletAddress
    const cacheKey = `${walletAddr || 'unknown'}:${providerAddress}`
    if (ackCache.has(cacheKey)) return

    let attemptedRecovery = false

    const doAck = async (): Promise<void> => {
      const tx = await broker.inference.acknowledgeProviderSigner(providerAddress)
      if (tx && typeof tx.wait === 'function') {
        const receipt = await tx.wait()
        const status = Number((receipt as any)?.status ?? 0)
        if (status === 1) {
          ackCache.add(cacheKey)
          console.log('ack=OK', { provider: providerAddress })
          return
        }
        throw new Error(`ack failed, receipt.status=${status}`)
      }
      // Some SDKs may not return a tx when already acknowledged
      ackCache.add(cacheKey)
      console.log('ack=OK', { provider: providerAddress })
      return
    }

    try {
      await doAck()
    } catch (e: any) {
      const msg: string = e?.message || ''
      if (msg.includes('already acknowledged')) {
        ackCache.add(cacheKey)
        console.log('ack=OK', { provider: providerAddress })
        return
      }
      if (!attemptedRecovery && msg.includes('Account does not exist')) {
        attemptedRecovery = true
        await this.ensureLedgerBalance(broker)
        await doAck()
        return
      }
      throw e
    }
  }

  private async sendInferenceRequest(params: {
    endpoint: string
    model: string
    headers: Record<string, string>
    message: string
    agentMetadata: any
  }): Promise<{ success: boolean; content: string; id?: string }> {
    const agentName = params.agentMetadata?.name || 'Agent'
    const agentDesc = params.agentMetadata?.description || ''
    const requestBody = {
      messages: [
        { 
          role: 'system', 
          content: `You are ${agentName}. ${agentDesc}` 
        },
        { role: 'user', content: params.message }
      ],
      model: params.model,
      stream: false
    }

    console.log('send=AI')

    // Implement 15s timeout per provider
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let response: Response
    try {
      response = await fetch(`${params.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          ...params.headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error('timeout>15s')
      }
      throw e
    } finally {
      clearTimeout(timeout)
    }

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
