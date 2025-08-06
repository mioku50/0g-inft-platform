/**
 * Enhanced Chat API Route with Rate Limiting Support
 * 
 * This route uses the improved ChatService with:
 * - Rate-limited RPC provider
 * - Enhanced broker caching and singleton pattern
 * - Provider acknowledgment caching
 * - Better error handling and fallbacks
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { ChatService } from '@/lib/compute/chat-service'

// Rate limiting per IP (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 30 // requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const current = requestCounts.get(ip)
  
  if (!current || now > current.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW })
    return true
  }
  
  if (current.count >= RATE_LIMIT) {
    return false
  }
  
  current.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait a moment before trying again.'
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { message, agentMetadata, providerAddress, prepared, prep } = body

    // Enhanced validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required and must be non-empty' },
        { status: 400 }
      )
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 4000 characters)' },
        { status: 400 }
      )
    }

    // Provide default agent metadata if not provided
    const defaultMetadata = {
      name: agentMetadata?.name || 'AI Assistant',
      description: agentMetadata?.description || 'Helpful AI assistant powered by 0G Compute Network'
    }

    console.log('\n=== Enhanced 0G Chat API ===')
    console.log('Message length:', message.length)
    console.log('Agent:', defaultMetadata.name)
    console.log('Provider preference:', providerAddress || 'auto-select')
    console.log('Client IP:', clientIP)
    console.log('Mode:', prepared ? 'non-custodial' : 'custodial')

    // Check if using non-custodial mode (prepared request)
    if (prepared === true && prep) {
      console.log('[CHAT] HIT – non-custodial')

      // Forward to proxy endpoint
      const origin = new URL(request.url).origin
      console.log('[PROXY] HIT – POST', `${origin}/api/compute/proxy`)
      const proxyResponse = await fetch(`${origin}/api/compute/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prep)
      })

      console.log('[PROXY] Response received from provider:', proxyResponse.status)
      const proxyResult = await proxyResponse.text()
      
      return new Response(proxyResult, {
        status: proxyResponse.status,
        headers: {
          'Content-Type': proxyResponse.headers.get('content-type') || 'application/json'
        }
      })
    }

    // Check if non-custodial mode is enforced
    const useNonCustodial = process.env.USE_NONCUSTODIAL_INFERENCE === 'true'
    console.log('[CHAT] Environment check:', {
      USE_NONCUSTODIAL_INFERENCE: process.env.USE_NONCUSTODIAL_INFERENCE,
      useNonCustodial,
      prepared,
      hasPrep: !!prep
    })
    
    if (useNonCustodial) {
      console.log('[CHAT] Non-custodial mode enforced but no prepared request provided')
      return NextResponse.json(
        { 
          success: false, 
          error: 'non_custodial_required',
          message: 'Non-custodial mode is enabled but no prepared request provided. Please connect wallet and try again.',
          requiresPreparedRequest: true
        },
        { status: 400 }
      )
    }

    // Use ChatService with rate limiting and enhanced caching
    const chatService = new ChatService(process.env.OG_COMPUTE_PRIVATE_KEY)
    
    const result = await chatService.processChat({
      message: message.trim(),
      agentMetadata: defaultMetadata
    })

    console.log('Chat processing result:', {
      success: result.success,
      isRealAI: result.isRealAI,
      model: result.model,
      provider: result.provider,
      timing: result.metadata.timing
    })

    // Return enhanced response
    return NextResponse.json({
      success: result.success,
      response: result.response,
      model: result.model,
      provider: result.provider,
      isRealAI: result.isRealAI,
      metadata: {
        timing: result.metadata.timing,
        servicesFound: result.metadata.servicesFound,
        rateLimited: false,
        cached: !!result.metadata.timing.initBroker && result.metadata.timing.initBroker < 100
      }
    })

  } catch (error: any) {
    console.error('Enhanced Chat API error:', error)
    
    // Enhanced error categorization
    let errorType = 'service_error'
    let statusCode = 500
    
    if (error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
      errorType = 'rate_limit'
      statusCode = 429
    } else if (error.message?.includes('timeout') || error.message?.includes('TIMEOUT')) {
      errorType = 'timeout'
      statusCode = 504
    } else if (error.message?.includes('network') || error.message?.includes('NETWORK')) {
      errorType = 'network_error'
      statusCode = 503
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorType,
        message: error.message,
        response: `I'm experiencing technical difficulties with the 0G Compute Network. Please try again in a moment.

🔧 **Technical Details:**
- Error: ${errorType}
- Message: ${error.message}

I'm still here to help you as soon as the connection is restored!`
      },
      { status: statusCode }
    )
  }
}