/**
 * Health check route - Updated for non-custodial compute
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Non-Custodial Compute Health Check ===')

    const healthStatus = {
      timestamp: new Date().toISOString(),
      mode: 'non-custodial',
      compute: {
        custodial: false,
        clientBrokerRequired: true,
        walletRequired: true,
        status: 'available'
      },
      storage: {
        custodial: true,
        serverKey: true,
        status: 'available'
      },
      migration: {
        enhancedInferenceRemoved: true,
        serverBrokerRemoved: true,
        computeProviderAdded: true
      }
    }

    return NextResponse.json({
      success: true,
      health: 'healthy',
      ...healthStatus
    })

  } catch (error: any) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Health check failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}