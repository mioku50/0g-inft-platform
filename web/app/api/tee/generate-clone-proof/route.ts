import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Проверяем параметры
    if (!body || typeof body !== 'object') {
      return NextResponse.json({
        error: 'Invalid request body'
      }, { status: 400 })
    }
    
    // Для упрощения возвращаем mock proof
    const proof = '0x' + Buffer.from(JSON.stringify({
      timestamp: Date.now(),
      verified: true
    })).toString('hex')
    
    return NextResponse.json({
      success: true,
      proof,
      sealedKey: '0x' + Buffer.from('mock-sealed-key').toString('hex')
    })
  } catch (error: any) {
    console.error('Clone proof error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to generate proof'
    }, { status: 500 })
  }
}