/**
 * Secure Compute Proxy API Route - Non-custodial Mode
 * 
 * This route acts as a secure proxy for prepared compute requests.
 * It does NOT sign any requests - all authentication is done client-side.
 * This enables non-custodial mode where users pay from their own wallets.
 * 
 * Security features:
 * - Host allowlist for authorized 0G providers only
 * - Header filtering to prevent sensitive data leakage
 * - Request size limits and basic rate limiting
 * - Streaming response support
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

// Allowlisted 0G compute provider hosts (updated for real 0G providers)
const ALLOWED_HOSTS = [
  // Official 0G provider hosts
  'provider-1.0g.ai',
  'provider-2.0g.ai', 
  'provider-3.0g.ai',
  'compute-testnet.0g.ai',
  'inference-testnet.0g.ai',
  'serving-testnet.0g.ai',
  
  // Known 0G provider endpoints (add more as discovered)
  'api.0g.ai',
  'testnet.0g.ai',
  'galileo-testnet.0g.ai',
  
  // Local development (remove in production)
  'localhost',
  '127.0.0.1',
  '0.0.0.0'
]

// Rate limiting (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 60 // requests per minute per IP
const RATE_WINDOW = 60 * 1000 // 1 minute
const MAX_BODY_SIZE = 1024 * 1024 // 1MB

// Allowed headers to forward (security filter)
const ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  'x-request-id',
  'x-user-address',
  'x-signature',
  'x-timestamp',
  'x-nonce',
  'x-payment-info'
]

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

function isAllowedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_HOSTS.some(allowed => 
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    )
  } catch {
    return false
  }
}

function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (ALLOWED_HEADERS.includes(lowerKey)) {
      filtered[key] = value
    }
  }
  
  return filtered
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'rate_limit_exceeded',
          message: 'Too many requests. Please wait before retrying.'
        },
        { status: 429 }
      )
    }

    // Parse and validate request
    const requestBody = await req.text()
    if (requestBody.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'request_too_large',
          message: 'Request body exceeds maximum allowed size.'
        },
        { status: 413 }
      )
    }

    const { endpoint, method, headers, body } = JSON.parse(requestBody)
    
    // Validate required fields
    if (!endpoint || !method || !headers || !body) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'invalid_request',
          message: 'Missing required fields: endpoint, method, headers, body' 
        },
        { status: 400 }
      )
    }

    // Security check: validate endpoint is in allowlist
    if (!isAllowedHost(endpoint)) {
      console.warn(`[Compute Proxy] Blocked request to unauthorized host: ${endpoint}`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'unauthorized_host',
          message: 'Request to unauthorized host blocked for security.'
        },
        { status: 403 }
      )
    }

    // Filter headers for security
    const filteredHeaders = filterHeaders(headers)

    console.log(`[PROXY] HIT - ${method} ${endpoint}`)
    console.log('[PROXY] Filtered headers:', Object.keys(filteredHeaders))
    
    // Forward the request to the 0G compute provider with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...filteredHeaders
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Get response content type
      const contentType = response.headers.get('content-type') || 'application/json'
      
      console.log(`[Compute Proxy] Response ${response.status} from ${new URL(endpoint).hostname}`)
      
      // Handle streaming responses (SSE/text streaming)
      if (contentType.includes('text/plain') || contentType.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        if (reader) {
          return new Response(response.body, {
            status: response.status,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
      
      // Handle JSON responses
      if (contentType.includes('application/json')) {
        const responseData = await response.json()
        
        // Log minimal metrics (no PII)
        console.log(`[Compute Proxy] Metrics: provider=${new URL(endpoint).hostname}, status=${response.status}, model=${responseData.model || 'unknown'}, isRealAI=true`)
        
        return NextResponse.json(responseData, {
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })
      }
      
      // Handle other response types
      const responseData = await response.text()
      return new Response(responseData, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*'
        }
      })
      
    } finally {
      clearTimeout(timeoutId)
    }

  } catch (error: any) {
    console.error('[Compute Proxy] Error:', error)
    
    // Log error metrics (no PII) - endpoint may not be available in error context
    const errorType = error.name === 'AbortError' ? 'timeout' : 'proxy_error'
    console.log(`[Compute Proxy] Error metrics: type=${errorType}`)
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorType,
        message: errorType === 'timeout' 
          ? 'Request timeout - provider took too long to respond'
          : 'Failed to proxy request to compute provider'
      },
      { status: errorType === 'timeout' ? 504 : 500 }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}