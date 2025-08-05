/**
 * Fine-tuning route - Currently disabled pending non-custodial migration
 * 
 * Note: Fine-tuning is temporarily disabled while migrating to non-custodial compute.
 * Storage operations remain custodial (server-side).
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    disabled: true,
    message: 'Fine-tuning is temporarily disabled during non-custodial compute migration.',
    status: 'coming_soon',
    note: 'Storage operations remain custodial. Compute operations are being migrated to non-custodial mode.'
  }, { status: 503 }) // Service Unavailable
}

export async function POST(request: NextRequest) {
  return NextResponse.json({
    disabled: true,
    message: 'Fine-tuning is temporarily disabled during non-custodial compute migration.',
    status: 'coming_soon',
    note: 'Use the coming soon page in the UI for more information.'
  }, { status: 503 }) // Service Unavailable
}