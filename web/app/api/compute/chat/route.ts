// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}

import { NextRequest, NextResponse } from 'next/server'
import { chatService } from '../../../../lib/compute/chat-service'

export async function POST(request: NextRequest) {
  try {
    const { message, agentMetadata } = await request.json()
    
    if (!message || !agentMetadata) {
      return NextResponse.json(
        { success: false, error: 'Missing message or agentMetadata' }, 
        { status: 400 }
      )
    }
    
    // Process chat with improved service
    const result = await chatService.processChat({
      message,
      agentMetadata
    })
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('❌ Chat API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        response: 'Sorry, I encountered an error processing your request.',
        error: error.message,
        isRealAI: false
      }, 
      { status: 500 }
    )
  }
}