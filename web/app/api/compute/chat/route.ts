// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/compute/chat-service'
import { EnhancedInferenceService } from '@/lib/compute/enhanced-inference-service'
import { getPrivateKey } from '@/lib/server/compute-env'
import { isFeatureEnabled } from '@/lib/utils/feature-flags'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { message, agentMetadata, options } = body

    // Validation
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

    console.log('\n=== Enhanced 0G Compute Chat Request ===')
    console.log('Message:', message)
    console.log('Agent:', agentMetadata.name)
    console.log('Enhanced UI:', isFeatureEnabled('ENHANCED_UI'))
    console.log('Streaming:', isFeatureEnabled('STREAMING_ENABLED'))

    // Choose service based on feature flags
    const USE_ENHANCED = process.env.ENHANCED_INFERENCE === '1' && process.env.ENHANCED_STABLE === '1'
    // After fixes: re-enable enhanced inference with proper flags  
    const useEnhanced = USE_ENHANCED  // <- enhanced inference now ready with readonly fix
    let result: any

    if (useEnhanced && USE_ENHANCED) {
      console.log('Using Enhanced Inference Service')
      const enhancedService = new EnhancedInferenceService(getPrivateKey())
      result = await enhancedService.processChat({ 
        message, 
        agentMetadata,
        options: {
          stream: isFeatureEnabled('STREAMING_ENABLED') && options?.stream,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          preferredProvider: options?.preferredProvider
        }
      })
    } else {
      console.log('Using Legacy Chat Service')
      const chatService = new ChatService(getPrivateKey())
      result = await chatService.processChat({ message, agentMetadata })
    }

    console.log('=== Enhanced Chat Response ===')
    console.log('Success:', result.success)
    console.log('Model:', result.model)
    console.log('Provider:', result.provider)
    console.log('Is Real AI:', result.isRealAI)
    console.log('TTFB:', result.metadata.timing.totalTTFB + 'ms')
    
    if (useEnhanced && USE_ENHANCED) {
      console.log('Verified:', result.metadata.isVerified)
      console.log('Est. Cost:', result.metadata.cost.estimatedCost, 'A0GI')
      console.log('Cache Hits:', result.metadata.timing.cacheHits)
      console.log('Rate Limit Hits:', result.metadata.timing.rateLimitHits)
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Enhanced chat route error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message,
        enhanced: useEnhanced && USE_ENHANCED
      },
      { status: 500 }
    )
  }
}