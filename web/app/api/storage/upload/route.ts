// app/api/storage/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client'

export async function POST(request: NextRequest) {
  try {
    const { data, owner } = await request.json()

    if (!data || !owner) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
    if (!privateKey) {
      throw new Error('OG_STORAGE_PRIVATE_KEY not configured')
    }

    // Используем реальный 0G Storage
    const result = await uploadToStorage(data, owner, privateKey)

    return NextResponse.json({
      ...result,
      success: true
    })
  } catch (error: any) {
    console.error('Storage upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload to storage' },
      { status: 500 }
    )
  }
}

// ===================================
// app/api/compute/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getComputeClient } from '@/lib/compute/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenId, messages, stream } = body

    if (!tokenId || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const compute = await getComputeClient()

    // Для streaming ответов
    if (stream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of compute.streamChat({ tokenId, messages })) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
              )
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Обычный запрос
    const response = await compute.chat({ tokenId, messages })
    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Compute chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    )
  }
}

// ===================================
// app/api/compute/services/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getComputeClient } from '@/lib/compute/client'

export async function GET(request: NextRequest) {
  try {
    const compute = await getComputeClient()
    const services = await compute.listServices()
    
    return NextResponse.json({
      success: true,
      services
    })
  } catch (error: any) {
    console.error('Failed to list services:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list services' },
      { status: 500 }
    )
  }
}

// ===================================
// app/api/compute/account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getComputeClient } from '@/lib/compute/client'

export async function GET(request: NextRequest) {
  try {
    const compute = await getComputeClient()
    const accountInfo = await compute.getAccountInfo()
    
    return NextResponse.json({
      success: true,
      accountInfo
    })
  } catch (error: any) {
    console.error('Failed to get account info:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get account info' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, amount } = await request.json()
    const compute = await getComputeClient()
    
    if (action === 'deposit') {
      await compute.deposit(amount)
      return NextResponse.json({
        success: true,
        message: `Deposited ${amount} ETH to ledger`
      })
    } else if (action === 'refund') {
      await compute.refund(amount)
      return NextResponse.json({
        success: true,
        message: `Requested refund of ${amount} ETH`
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Account action error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform account action' },
      { status: 500 }
    )
  }
}