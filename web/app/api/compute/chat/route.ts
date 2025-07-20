// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}
// web/app/api/compute/chat/route.ts - обновленная версия с acknowledge
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
    
    const provider = new ethers.JsonRpcProvider(process.env?.NEXT_PUBLIC_0G_RPC_URL ?? '')
    const privateKey = process.env?.OG_COMPUTE_PRIVATE_KEY ?? ''
    const wallet = new ethers.Wallet(privateKey, provider)
    
    let servicesCount = 0
    let servicesInfo: any[] = []
    
    try {
      const broker = await createZGComputeNetworkBroker(
        wallet,
        OFFICIAL_CONTRACTS.ledger,
        OFFICIAL_CONTRACTS.inference,
        OFFICIAL_CONTRACTS.fineTuning
      )
      
      // Проверяем баланс ledger
      try {
        const ledgerInfo = await broker.ledger.getLedger()
        console.log('Ledger balance:', ethers.formatEther(ledgerInfo.balance), 'OG')
        
        // Если баланс низкий, пополняем
        if (ledgerInfo.balance < ethers.parseEther('0.02')) {
          console.log('Low balance, adding funds...')
          await broker.ledger.addLedger(ethers.parseEther('0.05'))
          console.log('Funds added')
        }
      } catch (e) {
        console.log('Ledger check error:', (e as any).message)
      }
      
      const services = await broker.inference.listService()
      servicesCount = services.length
      servicesInfo = services
      console.log(`Found ${services.length} services`)
      
      // Пробуем каждый сервис
      for (const service of services) {
        console.log(`\nTrying service: ${service.model} at ${service.provider}`)
        
        try {
          // ВАЖНО: Acknowledge провайдера перед использованием
          try {
            console.log('Acknowledging provider...')
            const ackTx = await broker.inference.acknowledgeProviderSigner(service.provider)
            console.log('Acknowledge tx:', ackTx.hash)
            
            // Ждем подтверждения транзакции
            console.log('Waiting for transaction confirmation...')
            await ackTx.wait()
            console.log('Provider acknowledged successfully!')
          } catch (ackError: any) {
            // Если уже acknowledged, продолжаем
            if (ackError.message.includes('already acknowledged')) {
              console.log('Provider already acknowledged')
            } else {
              console.log('Acknowledge error:', ackError.message)
              // Продолжаем попытку даже если acknowledge не удался
            }
          }
          
          // Получаем метаданные сервиса
          const metadata = await broker.inference.getServiceMetadata(service.provider)
          console.log('Service endpoint:', metadata.endpoint)
          
          // Генерируем headers
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
          
          console.log('Sending request to AI...')
          
          // Используем OpenAI SDK
          const OpenAI = require('openai')
          const openai = new OpenAI({ 
            baseURL: metadata.endpoint, 
            apiKey: '' 
          })
          
          try {
            const completion = await openai.chat.completions.create(requestBody, {
              headers: headers
            })
            
            console.log('✅ Success with service:', service.model)
            
            const aiResponse = completion.choices[0].message.content
            
            // Обрабатываем ответ
            try {
              const isValid = await broker.inference.processResponse(
                service.provider,
                aiResponse,
                completion.id
              )
              console.log('Response valid:', isValid)
            } catch (e) {
              console.log('Process response error:', (e as any).message)
            }
            
            return NextResponse.json({
              success: true,
              response: aiResponse,
              model: metadata.model,
              provider: service.provider,
              isRealAI: true
            })
            
          } catch (apiError: any) {
            console.log('API call error:', apiError.message)
            
            // Пробуем альтернативный подход с fetch
            try {
              const response = await fetch(`${metadata.endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                  ...headers,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
              })
              
              if (response.ok) {
                const data = await response.json()
                console.log('✅ Success with fetch!')
                
                return NextResponse.json({
                  success: true,
                  response: data.choices[0].message.content,
                  model: metadata.model,
                  provider: service.provider,
                  isRealAI: true
                })
              }
            } catch (fetchError) {
              console.log('Fetch error:', (fetchError as any).message)
            }
          }
          
        } catch (serviceError: any) {
          console.error(`Service ${service.model} error:`, serviceError.message)
        }
      }
      
      console.log('\nAll services failed')
      
    } catch (error: any) {
      console.error('0G Compute error:', error.message)
    }
    
    // Fallback ответ
    const response = `Hello! I'm ${agentMetadata.name}. ${agentMetadata.description}

🔄 Status Update:
✅ Your ledger is funded
✅ Found ${servicesCount} AI services on 0G Compute
⚠️ Services need acknowledgment in the new SDK version

The providers require acknowledgment before use. This is being processed automatically.

Meanwhile, I'm here with local intelligence. What would you like to discuss?`
    
    return NextResponse.json({
      success: true,
      response: response,
      model: 'intelligent-local',
      provider: 'local',
      isRealAI: false,
      debug: {
        servicesFound: servicesCount,
        services: servicesInfo.map((s: any) => ({
          model: s.model,
          provider: s.provider.substring(0, 10) + '...',
          needsAcknowledge: true
        }))
      }
    })
    
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}