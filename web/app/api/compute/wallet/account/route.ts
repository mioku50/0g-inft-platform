/**
 * DEPRECATED: Wallet account route - Non-custodial migration
 * 
 * Wallet account information is now handled client-side.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'Wallet account information is now handled client-side.',
    migration: 'Use useAccount from wagmi and useCompute hook for account information'
  }, { status: 410 }) // Gone
}