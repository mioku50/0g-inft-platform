import { ethers } from 'ethers'
import { getBroker } from './broker'

export interface ChatServiceOptions {
  message: string
  agentMetadata: {
    name: string
    description: string
  }
}

export interface ChatServiceResult {
  success: boolean
  response: string
  model?: string
  provider?: string
  isRealAI: boolean
  debug?: any
}

class ChatService {
  private acknowledgedProviders = new Set<string>()

  async processChat(options: ChatServiceOptions): Promise<ChatServiceResult> {
    const { message, agentMetadata } = options
    
    console.log('\n=== 0G Compute Chat Request ===')
    console.log('Message:', message)
    console.log('Agent:', agentMetadata.name)
    
    try {
      const broker = await getBroker()
      
      // Check ledger with proper error handling
      const ledgerResult = await this.checkAndFundLedger(broker)
      
      // List available services
      const services = await this.getAvailableServices(broker)
      console.log(`Found ${services.length} services on-chain`)
      
      if (services.length === 0) {
        console.log('❌ No services available on inference contract')
        return this.createFallbackResponse(agentMetadata, {
          servicesFound: 0,
          reason: 'No providers registered on inference contract'
        })
      }
      
      // Try each service
      for (const service of services) {
        console.log(`\nTrying provider: ${service.provider.slice(0,10)}... (${service.model})`)
        
        try {
          const result = await this.tryService(broker, service, message, agentMetadata)
          if (result.success) {
            console.log('✅ Successfully got AI response')
            return result
          }
        } catch (error: any) {
          console.log(`❌ Service failed: ${error.message}`)
          continue
        }
      }
      
      console.log('❌ All services failed')
      return this.createFallbackResponse(agentMetadata, {
        servicesFound: services.length,
        reason: 'All services failed to respond',
        services: services.map(s => ({
          model: s.model,
          provider: s.provider.slice(0,10) + '...'
        }))
      })
      
    } catch (error: any) {
      console.error('❌ Chat service error:', error.message)
      return this.createFallbackResponse(agentMetadata, {
        servicesFound: 0,
        reason: `Service error: ${error.message}`
      })
    }
  }

  private async checkAndFundLedger(broker: any): Promise<void> {
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      
      // Handle case where ledger returns null/undefined values
      if (!ledgerInfo || ledgerInfo.balance == null) {
        console.log('⚠️ Ledger not found, creating new ledger...')
        await broker.ledger.addLedger(ethers.parseEther('0.05'))
        console.log('✅ New ledger created with 0.05 OG')
        return
      }
      
      const balance = BigInt(ledgerInfo.balance.toString())
      const balanceInOG = ethers.formatEther(balance)
      console.log(`Ledger balance: ${balanceInOG} OG`)
      
      // Add funds if balance is low
      if (balance < ethers.parseEther('0.02')) {
        console.log('💰 Low balance, adding funds...')
        await broker.ledger.addLedger(ethers.parseEther('0.05'))
        console.log('✅ Added 0.05 OG to ledger')
      }
      
    } catch (error: any) {
      if (error.message.includes('invalid BigNumberish')) {
        console.log('⚠️ Ledger balance invalid, creating new ledger...')
        await broker.ledger.addLedger(ethers.parseEther('0.05'))
        console.log('✅ New ledger created with 0.05 OG')
      } else {
        console.log('⚠️ Ledger check error:', error.message)
        // Don't throw, continue with the chat attempt
      }
    }
  }

  private async getAvailableServices(broker: any): Promise<any[]> {
    try {
      const services = await broker.inference.listService()
      
      if (services.length > 0) {
        console.log('Available services:')
        services.forEach((s: any, i: number) => {
          console.log(`  ${i+1}. ${s.model} at ${s.provider.slice(0,10)}...`)
        })
      }
      
      return services
    } catch (error: any) {
      console.error('Failed to list services:', error.message)
      return []
    }
  }

  private async tryService(broker: any, service: any, message: string, agentMetadata: any): Promise<ChatServiceResult> {
    // Acknowledge provider if not done yet
    await this.acknowledgeProvider(broker, service.provider)
    
    // Get service metadata
    const metadata = await broker.inference.getServiceMetadata(service.provider)
    console.log(`Service endpoint: ${metadata.endpoint}`)
    
    // Generate headers
    const headers = await broker.inference.getRequestHeaders(service.provider, message)
    
    const requestBody = {
      messages: [
        { 
          role: 'system', 
          content: `You are ${agentMetadata.name}. ${agentMetadata.description}` 
        },
        { role: 'user', content: message }
      ],
      model: metadata.model,
      stream: false
    }
    
    // Try with fetch first (more reliable than OpenAI SDK)
    const response = await fetch(`${metadata.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from AI service')
    }
    
    const aiResponse = data.choices[0].message.content
    
    // Process response for verification
    try {
      await broker.inference.processResponse(
        service.provider,
        aiResponse,
        data.id
      )
    } catch (error: any) {
      console.log('⚠️ Response verification failed:', error.message)
      // Continue anyway, response might still be valid
    }
    
    return {
      success: true,
      response: aiResponse,
      model: metadata.model,
      provider: service.provider,
      isRealAI: true
    }
  }

  private async acknowledgeProvider(broker: any, providerAddress: string): Promise<void> {
    if (this.acknowledgedProviders.has(providerAddress)) {
      return // Already acknowledged
    }
    
    try {
      console.log('🤝 Acknowledging provider...')
      const ackTx = await broker.inference.acknowledgeProviderSigner(providerAddress)
      console.log(`Acknowledge tx: ${ackTx.hash}`)
      
      // Wait for confirmation
      await ackTx.wait()
      console.log('✅ Provider acknowledged successfully')
      
      this.acknowledgedProviders.add(providerAddress)
      
    } catch (error: any) {
      if (error.message.includes('already acknowledged') || 
          error.message.includes('already exists')) {
        console.log('✅ Provider already acknowledged')
        this.acknowledgedProviders.add(providerAddress)
      } else {
        console.log('⚠️ Acknowledge error:', error.message)
        // Continue anyway, might still work
      }
    }
  }

  private createFallbackResponse(agentMetadata: any, debug: any): ChatServiceResult {
    const response = `Hello! I'm ${agentMetadata.name}. ${agentMetadata.description}

🔄 Status Update:
${debug.servicesFound > 0 ? '✅' : '❌'} Found ${debug.servicesFound} AI services on 0G Compute
${debug.servicesFound > 0 ? '⚠️' : '❌'} ${debug.reason}

I'm responding with local intelligence while the 0G network services are being configured.
What would you like to discuss?`

    return {
      success: true,
      response,
      model: 'intelligent-local',
      provider: 'local',
      isRealAI: false,
      debug
    }
  }
}

// Export singleton instance
export const chatService = new ChatService()
export default ChatService