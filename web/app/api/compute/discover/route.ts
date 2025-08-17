// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';
}

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { discoverServices } from '@/lib/compute/discovery'

/**
 * GET /api/compute/discover - Enhanced provider discovery endpoint
 * Uses broker-first approach with fallback to env providers
 */
export async function GET() {
  try {
    console.log('[discover] Starting enhanced provider discovery...')
    
    const result = await discoverServices()
    
    console.log(`[discover] Discovery completed: ${result.count} services found via ${result.source}`)
    
    // Return in format expected by frontend
    return NextResponse.json({
      success: true,
      count: result.count,
      services: result.services.map(service => ({
        provider: service.provider,
        model: service.model,
        serviceType: service.serviceType,
        url: service.url,
        inputPrice: service.inputPrice,
        outputPrice: service.outputPrice,
        verifiability: service.verifiability,
        isOfficial: isOfficialProvider(service.provider),
        isVerifiable: service.isVerifiable
      })),
      source: result.source,
      timestamp: result.timestamp
    })

  } catch (error: any) {
    console.error('[discover] Discovery failed:', error.message)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        count: 0,
        services: [],
        source: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Check if provider is in the official list
 */
function isOfficialProvider(address: string): boolean {
  const officialProviders = [
    '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
  ]
  
  return officialProviders.includes(address)
}