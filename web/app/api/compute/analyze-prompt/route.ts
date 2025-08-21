// web/app/api/compute/analyze-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK, ensureLedgerBalance, acknowledgeProviderIfNeeded } from '@/lib/compute/broker'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { getServerProvider } from '@/lib/server/provider'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body || {}
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

    const analysisPrompt = `You are a prompt engineer. Evaluate the following system prompt.

Prompt:
"""
${String(prompt || '').trim()}
"""

Tasks:
1) Score clarity, constraints, safety (1-10 each)
2) Provide 3-6 actionable improvement tips
3) List 2-5 potential risks/misuse

Return ONLY strict JSON with the following shape:
{
  "scores": { "clarity": number, "constraints": number, "safety": number },
  "tips": string[],
  "risks": string[]
}`

    // 1) Discover services
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

    // 2) Ensure ledger
    await ensureLedgerBalance(broker)
    if (services.length === 0) {
      return NextResponse.json({ error: 'no-services' }, { status: 503 })
    }

    for (const service of services) {
      try {
        // ACK safe
        await acknowledgeProviderIfNeeded(broker, service.provider)

        const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
        const headers = await broker.inference.getRequestHeaders(service.provider, analysisPrompt)
        console.log('headers=OK')

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 7000)
        let resp: Response
        try {
          resp = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({
              messages: [{ role: 'user', content: analysisPrompt }],
              model,
              stream: false
            }),
            signal: controller.signal
          })
        } finally {
          clearTimeout(timeout)
        }

        if (!resp.ok) {
          continue
        }

        const data = await resp.json()
        const text = data?.choices?.[0]?.message?.content
        if (!text || typeof text !== 'string') {
          continue
        }

        let parsed: any
        try {
          parsed = JSON.parse(text)
        } catch {
          continue
        }

        // Coerce to required structure
        const report = {
          scores: {
            clarity: Number(parsed?.scores?.clarity ?? 0) || 0,
            constraints: Number(parsed?.scores?.constraints ?? 0) || 0,
            safety: Number(parsed?.scores?.safety ?? 0) || 0,
          },
          tips: Array.isArray(parsed?.tips) ? parsed.tips.slice(0, 10) : [],
          risks: Array.isArray(parsed?.risks) ? parsed.risks.slice(0, 10) : [],
        }

        try {
          if (service?.verifiability) {
            await broker.inference.processResponse(service.provider, JSON.stringify(report), data?.id)
          }
        } catch {}

        console.log('generated')
        return NextResponse.json(report)
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('ServiceNotExist')) {
          try { await broker.inference.acknowledgeProviderSigner(service.provider) } catch {}
        }
      }
    }

    return NextResponse.json({ error: 'all-providers-failed' }, { status: 502 })
    
  } catch (error: any) {
    console.error('Prompt analysis error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}