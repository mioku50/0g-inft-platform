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
import { CHAT_LOG, PROXY_LOG } from '@/lib/utils/log'

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
          error: 'rate_limit',
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
        { success: false, error: 'bad_request', message: 'Message is required and must be non-empty' },
        { status: 400 }
      )
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { success: false, error: 'bad_request', message: 'Message too long (max 4000 characters)' },
        { status: 400 }
      )
    }

    // Provide default agent metadata if not provided
    const defaultMetadata = {
      name: agentMetadata?.name || 'AI Assistant',
      description: agentMetadata?.description || 'Helpful AI assistant powered by 0G Compute Network'
    }

    CHAT_LOG('HIT', { mode: prepared ? 'non-custodial' : 'custodial', clientIP })

    // Check if using non-custodial mode (prepared request)
    if (prepared === true && prep) {
      PROXY_LOG('HIT - forwarding prepared request')

      // Forward to proxy endpoint
      const origin = new URL(request.url).origin
      const proxyResponse = await fetch(`${origin}/api/compute/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(prep)
      })

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
    if (useNonCustodial && !prep) {
      return NextResponse.json(
        { 
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
      },
      { status: statusCode }
    )
  }
}