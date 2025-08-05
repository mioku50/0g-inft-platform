/**
 * DEPRECATED: Account route - Non-custodial migration
 * 
 * This route is deprecated in favor of client-side account management.
 * Use the ComputeProvider and ensureLedger utilities instead.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'This endpoint has been deprecated. Use client-side ComputeProvider instead.',
    migration: 'Use the useCompute hook and checkLedgerStatus from @/lib/compute/ensureLedger'
  }, { status: 410 }) // Gone
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'This endpoint has been deprecated. Use client-side ComputeProvider instead.',
    migration: 'Use createLedger from useCompute hook for account creation'
  }, { status: 410 }) // Gone
}