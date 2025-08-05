/**
 * DEPRECATED: Fine-tune account route - Non-custodial migration
 * 
 * Fine-tuning account management is now handled client-side.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'Fine-tuning account management has been moved to client-side.',
    migration: 'Use ComputeProvider and fine-tuning hooks for account management'
  }, { status: 410 }) // Gone
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    deprecated: true,
    message: 'Fine-tuning account creation has been moved to client-side.',
    migration: 'Use createLedger from useCompute hook'
  }, { status: 410 }) // Gone
}