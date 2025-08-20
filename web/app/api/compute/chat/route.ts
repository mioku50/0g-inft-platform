// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}
// web/app/api/compute/chat/route.ts - updated for SDK 0.3.1
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK } from '@/lib/compute/broker'
import { chatService } from '@/lib/compute/chat-service'

export async function POST(request: NextRequest) {
  try {
    const { message, agentMetadata } = await request.json()
    
    console.log('\n=== 0G Compute Chat Request (SDK 0.3.1) ===')
    console.log('Message:', message)
    
    const broker = await createBrokerWithEnvPK()
    const result = await chatService.processChat({ message, agentMetadata, broker })
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      response: 'Service temporarily unavailable. Please try again.',
      isRealAI: false
    }, { status: 500 })
  }
}