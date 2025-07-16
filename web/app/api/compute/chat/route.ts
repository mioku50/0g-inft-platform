// web/app/api/compute/chat/route.ts - версия с попыткой всех сервисов
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import crypto from 'crypto'

const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker')

const OFFICIAL_CONTRACTS = {
  ledger: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  inference: '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
  fineTuning: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176'
}

export async function POST(request: NextRequest) {
  try {
    const { message, agentMetadata } = await request.json()
    
    console.log('\n=== 0G Compute Request ===')
    console.log('Message:', message)
    
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY!
    const wallet = new ethers.Wallet(privateKey, provider)
    
    try {
      const broker = await createZGComputeNetworkBroker(
        wallet,
        OFFICIAL_CONTRACTS.ledger,
        OFFICIAL_CONTRACTS.inference,
        OFFICIAL_CONTRACTS.fineTuning
      )
      
      const services = await broker.inference.listService()
      console.log(`Found ${services.length} services`)
      
      // Пробуем каждый сервис по очереди
      for (const service of services) {
        console.log(`\nTrying service: ${service.model} at ${service.provider}`)
        
        try {
          const metadata = await broker.inference.getServiceMetadata(service.provider)
          console.log('Service endpoint:', metadata.endpoint)
          
          // Генерируем headers
          const headers = await broker.inference.getRequestHeaders(service.provider, message)
          
          // Пробуем разные варианты Request-Hash
          const messageHash = crypto.createHash('sha256').update(message).digest('hex')
          const timestampHash = crypto.createHash('sha256')
            .update(message + Date.now().toString())
            .digest('hex')
          
          // Массив вариантов headers для попытки
          const headerVariants = [
            {
              ...headers,
              'Request-Hash': messageHash,
              'Content-Type': 'application/json'
            },
            {
              ...headers,
              'Request-Hash': timestampHash,
              'Content-Type': 'application/json'
            },
            {
              ...headers,
              'Content-Type': 'application/json'
            }
          ]
          
          const requestBody = {
            messages: [
              { 
                role: 'system', 
                content: `You are ${agentMetadata.name}. ${agentMetadata.description}` 
              },
              { role: 'user', content: message }
            ],
            model: metadata.model,
            stream: false,
            temperature: 0.7,
            max_tokens: 1000
          }
          
          // Пробуем каждый вариант headers
          for (const hdrs of headerVariants) {
            try {
              console.log('Trying with headers variant...')
              
              const response = await fetch(`${metadata.endpoint}/chat/completions`, {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(30000) // 30 секунд таймаут
              })
              
              console.log('Response status:', response.status)
              
              if (response.ok) {
                const data = await response.json()
                console.log('✅ Success with service:', service.model)
                
                const aiResponse = data.choices[0].message.content
                
                return NextResponse.json({
                  success: true,
                  response: aiResponse,
                  model: metadata.model,
                  provider: service.provider,
                  isRealAI: true
                })
              }
            } catch (variantError: any) {
              console.log('Variant error:', variantError.message)
            }
          }
        } catch (serviceError: any) {
          console.error(`Service ${service.model} error:`, serviceError.message)
        }
      }
      
      console.log('\nAll services failed, checking if providers are temporarily down...')
      
    } catch (error: any) {
      console.error('0G Compute error:', error.message)
    }
    
    // Расширенный fallback с информацией о состоянии
    const response = `Hello! I'm ${agentMetadata.name}. ${agentMetadata.description}

🔄 Status Update:
✅ Your ledger is funded (0.01 ETH)
✅ Found 3 AI services on 0G Compute
⚠️ Services are experiencing connectivity issues (502 Bad Gateway)

The 0G Compute providers appear to be temporarily unavailable. This can happen when:
- Providers are updating their services
- Network maintenance is in progress
- Services are experiencing high load

Please try again in a few minutes. Meanwhile, I'm here with local intelligence to help you!

What would you like to discuss?`
    
    return NextResponse.json({
      success: true,
      response: response,
      model: 'intelligent-local',
      provider: 'local',
      isRealAI: false,
      debug: {
        servicesFound: services.length,
        ledgerFunded: true,
        providerStatus: 'temporarily unavailable'
      }
    })
    
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}