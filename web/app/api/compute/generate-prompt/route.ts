// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK, ensureLedgerBalance, acknowledgeProviderIfNeeded } from '@/lib/compute/broker'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { getServerProvider } from '@/lib/server/provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, capabilities = [], personality } = body || {}
    const address: string | undefined = body?.address
    const signature: string | undefined = body?.signature
    const message: string | undefined = body?.message
    const tokenIdRaw: any = body?.tokenId

    if (!address || !signature || !message || tokenIdRaw === undefined) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const recovered = ethers.verifyMessage(message, signature)
    const recoveredLc = recovered?.toLowerCase?.() || ''
    const addressLc = address.toLowerCase()
    if (recoveredLc !== addressLc) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const provider = getServerProvider()
    const contract = new ethers.Contract(process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!, INFT_ABI, provider)
    const onchainOwner: string = await contract.ownerOf(BigInt(Number(tokenIdRaw)))
    if (!onchainOwner || onchainOwner.toLowerCase() !== addressLc) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('owner=OK')

    const broker = await createBrokerWithEnvPK()
    console.log('rpc=OK')

    // Собираем пользовательский инпут
    const caps = Array.isArray(capabilities) ? capabilities.slice().filter(Boolean) : []
    const prompt = `You are tasked with writing a production-grade system prompt for an AI agent.

Context:
- Description: ${String(description || '').trim()}
- Capabilities: ${caps.join(', ')}
- Personality: ${String(personality || '').trim()}

Requirements:
1) Define the agent's purpose, role, and behavior succinctly
2) State dos/don'ts and boundaries clearly
3) Specify response style and formatting rules
4) Include 3-5 concrete instruction bullets for critical behaviors
5) Keep it safe and compliant

Output: Return ONLY the final system prompt text.`

    // 1) Discover services and prefer official/TEE
    let services = await broker.inference.listService()
    services = Array.from(services || [])
      .slice()
      .sort((a: any, b: any) => {
        const aInfo = String(a?.additionalInfo || a?.verifiability || '').toLowerCase()
        const bInfo = String(b?.additionalInfo || b?.verifiability || '').toLowerCase()
        const aScore = (aInfo.includes('official') || aInfo.includes('0g') || aInfo.includes('tee')) ? 1 : 0
        const bScore = (bInfo.includes('official') || bInfo.includes('0g') || bInfo.includes('tee')) ? 1 : 0
        return bScore - aScore
      })
    console.log(`services=${services.length}`)

    // 2) Ensure ledger (create/deposit) before ACK
    await ensureLedgerBalance(broker)

    if (services.length === 0) {
      return NextResponse.json({ error: 'no-services' }, { status: 503 })
    }

    // 3) Try providers sequentially; single-use headers per attempt
    for (const service of services) {
      try {
        // ACK (safe, cached)
        await acknowledgeProviderIfNeeded(broker, service.provider)

        // Metadata and headers
        const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
        const headers = await broker.inference.getRequestHeaders(service.provider, prompt)
        console.log('headers=OK')

        // 4) Request with 5s timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        let resp: Response
        try {
          resp = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              messages: [{ role: 'user', content: prompt }],
              model,
              stream: false
            }),
            signal: controller.signal
          })
        } finally {
          clearTimeout(timeout)
        }

        if (!resp.ok) {
          // 4xx/5xx → next provider
          continue
        }

        const data = await resp.json()
        const generatedPrompt = data?.choices?.[0]?.message?.content
        if (!generatedPrompt || typeof generatedPrompt !== 'string') {
          continue
        }

        // Optional verification for verifiable services
        try {
          if (service?.verifiability) {
            await broker.inference.processResponse(service.provider, generatedPrompt, data?.id)
          }
        } catch {}

        console.log('generated')
        return NextResponse.json({ prompt: generatedPrompt })
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('ServiceNotExist')) {
          try { await broker.inference.acknowledgeProviderSigner(service.provider) } catch {}
        }
        // try next
      }
    }

    return NextResponse.json({ error: 'all-providers-failed' }, { status: 502 })
    
  } catch (error: any) {
    console.error('Prompt generation error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}