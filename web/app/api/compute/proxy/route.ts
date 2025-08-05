/**
 * Compute Proxy API Route - Non-custodial Mode
 * 
 * This route acts as a simple proxy for prepared compute requests.
 * It does NOT sign any requests - all authentication is done client-side.
 * This enables non-custodial mode where users pay from their own wallets.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { endpoint, method, headers, body } = await req.json()
    
    // Validate required fields
    if (!endpoint || !method || !headers || !body) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: endpoint, method, headers, body' 
        },
        { status: 400 }
      )
    }

    console.log(`[Compute Proxy] ${method} ${endpoint}`)
    console.log('[Compute Proxy] Headers:', Object.keys(headers))
    
    // Forward the request to the 0G compute provider
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    })

    // Get response content type
    const contentType = response.headers.get('content-type') || 'application/json'
    
    // Handle different response types
    let responseData
    if (contentType.includes('application/json')) {
      responseData = await response.json()
    } else {
      responseData = await response.text()
    }

    console.log(`[Compute Proxy] Response status: ${response.status}`)
    
    // Return the provider response as-is
    return new Response(
      typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    )

  } catch (error: any) {
    console.error('[Compute Proxy] Error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'proxy_error',
        message: error.message || 'Failed to proxy request to compute provider'
      },
      { status: 500 }
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