// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';   // любая строка X.Y.Z
}
// web/app/api/compute/chat/route.ts - updated for SDK 0.3.1
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK } from '@/lib/compute/broker'
import { chatService } from '@/lib/compute/chat-service'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { getServerProvider } from '@/lib/server/provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const message: string = body?.message
    const agentMetadata: any = body?.agentMetadata
    const agentId: number | string | undefined = body?.agentId ?? body?.tokenId ?? body?.id

    // Minimal logs without sensitive data
    console.log('\n=== 0G Compute Chat Request (SDK 0.3.1) ===')
    console.log('rpc=OK')

    // Server-side owner validation
    if (agentId === undefined || agentId === null || Number.isNaN(Number(agentId))) {
      return NextResponse.json({ reason: 'bad-request' }, { status: 400 })
    }

    let sessionAddress: string | undefined
    try {
      const sessionCookie = request.cookies.get('siwe-session')?.value
      if (sessionCookie) {
        const parsed = JSON.parse(sessionCookie)
        sessionAddress = parsed?.address
      }
    } catch {}

    // Optional header-based fallback (do not log values)
    if (!sessionAddress) {
      sessionAddress = request.headers.get('x-address') || request.headers.get('x-wallet-address') || undefined
    }

    if (!sessionAddress) {
      console.warn('owner-check: no-session')
      return NextResponse.json({ reason: 'not-owner' }, { status: 403 })
    }

    const provider = getServerProvider()
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
      INFT_ABI,
      provider
    )
    const onchainOwner: string = await contract.ownerOf(BigInt(Number(agentId)))
    if (!onchainOwner || onchainOwner.toLowerCase() !== sessionAddress.toLowerCase()) {
      console.warn('owner-check: mismatch')
      return NextResponse.json({ reason: 'not-owner' }, { status: 403 })
    }
    console.log('owner=OK')

    const broker = await createBrokerWithEnvPK()
    const safeAgentMetadata = agentMetadata ?? {
      name: `Agent #${Number(agentId)}`,
      description: 'AI Assistant',
      model: 'llama-3.3-70b'
    }
    const result = await chatService.processChat({ message, agentMetadata: safeAgentMetadata, broker })
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Chat API error:', error?.message || String(error))
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'unknown',
      response: 'Service temporarily unavailable. Please try again.',
      isRealAI: false
    }, { status: 500 })
  }
}