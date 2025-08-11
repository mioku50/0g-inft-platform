/**
 * Health check route - Updated for non-custodial compute with SDK diagnostics
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const sdkVersion = process.env.NEXT_PUBLIC_BROKER_SDK_VERSION || 'unknown'

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sdkVersion,
      sdkExports: [],
      nonCustodial: true,
      hasServerKeys: false
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Health check failed', details: error.message },
      { status: 500 }
    )
  }
}