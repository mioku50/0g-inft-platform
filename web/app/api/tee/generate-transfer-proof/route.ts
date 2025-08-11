// web/app/api/tee/generate-transfer-proof/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'This endpoint is disabled in non-custodial mode',
      message: 'TEE operations should be performed client-side with connected wallet'
    },
    { status: 501 }
  )
}