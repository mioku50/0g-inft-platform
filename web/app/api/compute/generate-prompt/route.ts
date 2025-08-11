// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'This endpoint is disabled in non-custodial mode',
      message: 'Please use client-side compute operations with connected wallet'
    },
    { status: 501 }
  )
}