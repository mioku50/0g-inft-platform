/**
 * Health check route - Updated for non-custodial compute with SDK diagnostics
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Basic health info
    const healthStatus: any = {
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

    // SDK diagnostics (client-side only - no server import)
    try {
      // Get package.json version only
      const SDK_PKG = ['@0glabs', '0g-serving-broker'].join('/')
      const packageVersion = require('../../../../package.json').dependencies[SDK_PKG]

      healthStatus.sdk = {
        name: SDK_PKG,
        version: packageVersion || '0.2.14',
        sdkVersion: '0.2.14',
        note: 'SDK can only be tested client-side'
      }
    } catch (e) {
      healthStatus.sdk = {
        error: 'unavailable',
        details: (e as Error).message,
        sdkVersion: '0.2.14' // fallback
      }
    }

    // Env flags
    healthStatus.flags = {
      USE_NONCUSTODIAL_INFERENCE: process.env.USE_NONCUSTODIAL_INFERENCE || 'false',
      NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG || '0',
    }

    return NextResponse.json({ success: true, health: 'healthy', ...healthStatus })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Health check failed', details: error.message },
      { status: 500 }
    )
  }
}