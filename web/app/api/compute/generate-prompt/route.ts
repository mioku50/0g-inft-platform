// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK, ensureLedgerBalance, acknowledgeProviderIfNeeded } from '@/lib/compute/broker'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { getServerProvider } from '@/lib/server/provider'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, capabilities = [], personality } = body || {}
    const address: string | undefined = body?.address
    const signature: string | undefined = body?.signature
    const message: string | undefined = body?.message
    const tokenIdRaw: any = body?.tokenId
    const clientMaxTokens: any = body?.maxTokens

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
    const userDescription: string = String(description || '').trim()
    const caps = Array.isArray(capabilities) ? capabilities.slice().filter(Boolean) : []
    const sysMessage = 'You are a prompt generator. Create a production-grade system prompt for an AI agent. Respond with ONLY the final system prompt text.'

    // Определяем max_tokens: client override -> env -> default 256
    const envMax = Number(process.env.GENERATE_MAX_TOKENS || '256')
    const parsedClient = Number(clientMaxTokens)
    const chosenMaxTokens = Number.isFinite(parsedClient) && parsedClient > 0 ? parsedClient : (Number.isFinite(envMax) && envMax > 0 ? envMax : 256)

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
    const errors: Array<{ provider: string; code: string; message?: string; httpStatus?: number }> = []
    for (const service of services) {
      try {
        // ACK (safe, cached)
        await acknowledgeProviderIfNeeded(broker, service.provider)

        // Metadata and headers
        const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
        const buildBody = () => ({
          model,
          messages: [
            { role: 'system', content: sysMessage },
            { role: 'user', content: userDescription }
          ],
          max_tokens: chosenMaxTokens,
          temperature: 0.7,
          stream: false
        })

        const makeRequest = async (headers: Record<string, string>) => {
          // 35s timeout
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 35000)
          try {
            return await fetch(`${endpoint}/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify(buildBody()),
              signal: controller.signal
            })
          } finally {
            clearTimeout(timeout)
          }
        }

        // First attempt
        let headers = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
        console.log('headers=OK')
        let resp = await makeRequest(headers)

        // Read raw text first
        let rawText = await resp.text()
        let snippet = rawText.slice(0, 200)
        console.log(`prov=${service.provider} status=${resp.status} len=${rawText.length} body_snippet=${JSON.stringify(snippet)}`)

        // Handle insufficient balance specifically (HTTP 400)
        if (resp.status === 400) {
          const txt = rawText
          if (/insufficient balance/i.test(txt)) {
            const m = txt.match(/total fee of (\d+) exceeds the available balance of (\d+)/i)
            if (m) {
              try {
                const needed = BigInt(m[1]); const have = BigInt(m[2]);
                const deficitOG = Number(needed - have) / 1e18;
                const topUp = Math.max(0.02, deficitOG * 2);
                // Top-up and retry once with new headers
                await ensureLedgerBalance(broker, topUp)
                const headers2 = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
                resp = await makeRequest(headers2)
                rawText = await resp.text()
                snippet = rawText.slice(0, 200)
                console.log(`prov=${service.provider} retry status=${resp.status} len=${rawText.length} body_snippet=${JSON.stringify(snippet)}`)
              } catch (topupErr: any) {
                errors.push({ provider: service.provider, code: 'provider_http_400_insufficient_balance', message: (topupErr?.message || snippet), httpStatus: 400 })
                continue
              }
            }
          }
        }

        if (!resp.ok) {
          if (resp.status === 400 && /headers?\s+.*used/i.test(rawText)) {
            errors.push({ provider: service.provider, code: 'headers_used', message: snippet, httpStatus: 400 })
          } else if (resp.status === 400 && /insufficient balance/i.test(rawText)) {
            errors.push({ provider: service.provider, code: 'provider_http_400_insufficient_balance', message: snippet, httpStatus: 400 })
          } else {
            const code = resp.status >= 500 ? 'http_5xx' : resp.status >= 400 ? `http_${resp.status}` : `http_${resp.status}`
            errors.push({ provider: service.provider, code, httpStatus: resp.status, message: snippet })
          }
          continue
        }

        let data: any = null
        try {
          data = JSON.parse(rawText)
        } catch (e: any) {
          errors.push({ provider: service.provider, code: 'invalid_json', message: e?.message })
          continue
        }
        const generatedPrompt = data?.choices?.[0]?.message?.content
        if (!generatedPrompt || typeof generatedPrompt !== 'string') {
          errors.push({ provider: service.provider, code: 'invalid_response', message: snippet })
          continue
        }

        // Optional verification for verifiable services
        try {
          if (service?.verifiability) {
            await broker.inference.processResponse(service.provider, generatedPrompt, data?.id)
          }
        } catch {}

        console.log('generated')

        // Save prompt for this agent
        try {
          const promptsDir = path.join(process.cwd(), 'data', 'prompts')
          await fs.mkdir(promptsDir, { recursive: true })
          const tokenIdNum = Number(tokenIdRaw)
          const filePath = path.join(promptsDir, `${tokenIdNum}.json`)
          const payload = { prompt: generatedPrompt, updatedAt: Date.now() }
          await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
        } catch (e) {
          // Non-fatal
        }

        return NextResponse.json({ ok: true, prompt: generatedPrompt, provider: service.provider, model })
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('ServiceNotExist')) {
          try { await broker.inference.acknowledgeProviderSigner(service.provider) } catch {}
        }
        // classify error
        if (msg.includes('headers') && msg.includes('used')) {
          errors.push({ provider: service.provider, code: 'headers_used', message: msg })
        } else if (/insufficient/i.test(msg)) {
          errors.push({ provider: service.provider, code: 'provider_http_400_insufficient_balance', message: msg })
        } else if (msg.includes('timeout')) {
          errors.push({ provider: service.provider, code: 'timeout', message: msg })
        } else {
          errors.push({ provider: service.provider, code: 'provider_error', message: msg })
        }
        // try next
      }
    }

    const first = errors[0]
    // Map insufficient to top-level error if present
    const insufficient = errors.find(e => e.code === 'provider_http_400_insufficient_balance')
    const topLevelError = insufficient ? 'insufficient_balance' : 'all-providers-failed'
    const status = insufficient ? 402 : 502
    return NextResponse.json({ ok: false, error: topLevelError, reasons: errors, reason: first?.code, details: first }, { status })
    
  } catch (error: any) {
    console.error('Prompt generation error:', error)
    return NextResponse.json(
      { error: 'unexpected', message: error.message },
      { status: 500 }
    )
  }
}