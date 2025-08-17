// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/compute/chat-service'
import { DirectChatService } from '@/lib/compute/direct-chat-service'
import { getPrivateKey } from '@/lib/server/compute-env'

export async function POST(request: NextRequest) {
  try {
    // Парсим тело запроса
    const body = await request.json()
    const { message, agentMetadata } = body

    // Валидация
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    if (!agentMetadata || !agentMetadata.name || !agentMetadata.description) {
      return NextResponse.json(
        { success: false, error: 'Agent metadata with name and description is required' },
        { status: 400 }
      )
    }

    console.log('\n=== 0G Compute Chat Request ===')
    console.log('Message:', message)
    console.log('Agent:', agentMetadata.name)

    // Попробуем сначала использовать полную интеграцию с 0G SDK
    try {
      const chatService = new ChatService(getPrivateKey())
      const result = await chatService.processChat({ message, agentMetadata })

      // Если получили успешный ответ с реальным AI, возвращаем его
      if (result.success && result.isRealAI) {
        console.log('=== Chat Response (0G SDK) ===')
        console.log('Success:', result.success)
        console.log('Model:', result.model)
        console.log('Provider:', result.provider)
        console.log('Is Real AI:', result.isRealAI)
        console.log('TTFB:', result.metadata.timing.totalTTFB + 'ms')
        
        return NextResponse.json(result)
      }
    } catch (sdkError: any) {
      console.log('0G SDK error, falling back to direct service:', sdkError.message)
    }

    // Если 0G SDK не сработал, используем прямой сервис
    const directService = new DirectChatService()
    const result = await directService.processChat({ message, agentMetadata })

    console.log('=== Chat Response (Direct) ===')
    console.log('Success:', result.success)
    console.log('Model:', result.model)
    console.log('Provider:', result.provider)
    console.log('Is Real AI:', result.isRealAI)
    console.log('TTFB:', result.metadata.timing.totalTTFB + 'ms')

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Route error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    )
  }
}