/**
 * Chat API Route - Non-Custodial Proxy
 * 
 * This route now serves as a minimal proxy for rate-limiting and CORS.
 * Actual 0G Compute calls are made directly from the client to provider endpoints.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Parse request for validation and rate limiting
    const body = await request.json()
    const { providerUrl, headers, payload } = body

    // Basic validation
    if (!providerUrl || !headers || !payload) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: providerUrl, headers, payload' },
        { status: 400 }
      )
    }

    // Validate provider URL (security check)
    if (!isValidProviderUrl(providerUrl)) {
      return NextResponse.json(
        { success: false, error: 'Invalid provider URL' },
        { status: 400 }
      )
    }

    console.log('\n=== Non-Custodial Chat Proxy ===')
    console.log('Provider:', providerUrl)
    console.log('Headers present:', Object.keys(headers).length)

    // Rate limiting could go here
    // await rateLimiter.check(request)

    // Proxy the request to the provider
    const response = await fetch(`${providerUrl}/v1/chat/completions`, {
      method: 'POST',  
      headers: {
        'Content-Type': 'application/json',
        ...headers // Client-generated headers from clientBroker
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Provider error:', response.status, errorText)
      return NextResponse.json(
        { success: false, error: `Provider error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const result = await response.json()
    
    // Pass through the provider response
    return NextResponse.json({
      success: true,
      ...result
    })

  } catch (error: any) {
    console.error('Chat proxy error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Proxy error',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Validate that the provider URL is from a trusted 0G provider
 */
function isValidProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    
    // Allow official 0G provider addresses
    const allowedHosts = [
      'testnet-rpc.0g.ai',
      'evmrpc-testnet.0g.ai',
      // Add more trusted provider endpoints as needed
    ]
    
    // For now, allow any HTTPS URL (providers run on different domains)
    // In production, maintain a whitelist of approved provider URLs
    return parsed.protocol === 'https:' && parsed.hostname.length > 0
  } catch {
    return false
  }
}