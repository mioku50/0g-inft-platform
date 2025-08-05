/**
 * DEPRECATED: Balance route - Non-custodial migration
 * 
 * Balance checking is now handled client-side through the ComputeProvider.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    deprecated: true,
    message: 'This endpoint has been deprecated. Use client-side ledger status instead.',
    migration: 'Use ledgerStatus from useCompute hook to check balance'
  }, { status: 410 }) // Gone
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'Deposit functionality has moved to client-side.',
    migration: 'Use depositToLedger from useCompute hook for deposits'
  }, { status: 410 }) // Gone
}