// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK, ensureLedgerBalance, acknowledgeProviderIfNeeded, LEDGER_DECIMALS } from '@/lib/compute/broker'
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

    if (services.length === 0) {
      return NextResponse.json({ error: 'no-services' }, { status: 503 })
    }

    const short = (addr?: string) => {
      if (!addr || addr.length < 10) return addr || ''
      return `${addr.slice(0, 4)}…${addr.slice(-3)}`
    }

    // 2) Try providers sequentially; single-use headers per attempt
    for (const service of services) {
      let autoTopUp = false
      try {
        // ACK (safe, cached)
        await acknowledgeProviderIfNeeded(broker, service.provider)

        // Metadata (for logs)
        const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)

        // Build request body factory
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

        // Generate headers (first time) to extract payee
        let headers = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
        console.log('headers=OK', { provider: service.provider })
        try { console.debug('headers_debug', headers) } catch {}

        // Extract payee from headers
        const headerKeys = Object.keys(headers || {}).reduce((acc: Record<string, string>, k) => {
          acc[k.toLowerCase()] = headers[k]
          return acc
        }, {})
        let payee: string | undefined = headerKeys['x-og-ledger-owner'] || headerKeys['x-og-account'] || headerKeys['x-0g-user']
        if (!payee) {
          payee = (broker as any)?.__walletAddress
          console.warn('WARN: payee not found in headers; falling back to owner', { owner: short(payee) })
        }
        console.log(`headers=OK payee=${short(payee)}`)

        // Ensure min balance before first request
        const ensure1 = await ensureLedgerBalance(broker, { payee, minRequiredOG: 0.05, reserveOG: 0.05 })
        if (ensure1 === 'payee_unsupported') {
          return NextResponse.json({ ok: false, error: 'insufficient_balance', reason: 'payee_unsupported', payee }, { status: 402 })
        }

        // First attempt
        let resp = await makeRequest(headers)
        let rawText = await resp.text()
        let snippet = rawText.slice(0, 200)
        console.log(`prov=${service.provider} status=${resp.status} len=${rawText.length} body_snippet=${JSON.stringify(snippet)}`)

        // If 400 insufficient balance → parse JSON, top up, re-fetch headers (force) and retry once
        if (resp.status === 400) {
          let feeOG = 0
          let haveOG = 0
          try {
            const j = JSON.parse(rawText)
            const errStr: string = String(j?.error || '')
            const m = errStr.match(/total fee of (\d+) exceeds the available balance of (\d+)/i)
            if (m) {
              const neededAtomic = BigInt(m[1])
              const haveAtomic = BigInt(m[2])
              feeOG = Number(ethers.formatUnits(neededAtomic, Number(LEDGER_DECIMALS)))
              haveOG = Number(ethers.formatUnits(haveAtomic, Number(LEDGER_DECIMALS)))
            }
          } catch {}

          if (/insufficient balance/i.test(rawText) && feeOG > 0) {
            const reserve = Number(process.env.NEXT_PUBLIC_COMPUTE_RESERVE_OG ?? '0.05') || 0.05
            const needOG = feeOG + reserve
            console.log(`available=${haveOG.toFixed(4)} OG, need>=${needOG.toFixed(4)} OG (fee=${feeOG.toFixed(4)} OG, reserve=${reserve.toFixed(4)} OG)`)            
            const ensure2 = await ensureLedgerBalance(broker, { payee, minRequiredOG: feeOG, reserveOG: reserve })
            if (ensure2 === 'payee_unsupported') {
              return NextResponse.json({ ok: false, error: 'insufficient_balance', reason: 'payee_unsupported', payee }, { status: 402 })
            }
            autoTopUp = true
            console.log(`retrying provider=${service.provider}`)
            // Re-generate headers for retry (force new headers)
            try {
              const maybeHeaders: any = (broker as any)?.inference?.getRequestHeaders
              if (typeof maybeHeaders === 'function' && maybeHeaders.length >= 3) {
                headers = await (broker as any).inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt', { force: true })
              } else {
                headers = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
              }
            } catch {
              headers = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
            }

            // Second attempt (only once)
            resp = await makeRequest(headers)
            rawText = await resp.text()
            snippet = rawText.slice(0, 200)
            console.log(`prov=${service.provider} status=${resp.status} len=${rawText.length} body_snippet=${JSON.stringify(snippet)}`)

            if (resp.status === 400 && /insufficient balance/i.test(rawText)) {
              return NextResponse.json({ ok: false, error: 'insufficient_balance', reason: 'provider_fee_exceeds_balance', need: Number(feeOG.toFixed(4)), payee, autoTopUp: true }, { status: 402 })
            }
          }
        }

        if (!resp.ok) {
          const code = `provider_http_${resp.status}`
          return NextResponse.json({ ok: false, error: code }, { status: resp.status })
        }

        let data: any = null
        try {
          data = JSON.parse(rawText)
        } catch (e: any) {
          return NextResponse.json({ ok: false, error: 'invalid_json', details: e?.message }, { status: 502 })
        }
        const generatedPrompt = data?.choices?.[0]?.message?.content
        if (!generatedPrompt || typeof generatedPrompt !== 'string') {
          return NextResponse.json({ ok: false, error: 'invalid_response' }, { status: 502 })
        }

        // Optional verification for verifiable services
        try {
          if (service?.verifiability) {
            await broker.inference.processResponse(service.provider, generatedPrompt, data?.id)
          }
        } catch {}

        console.log('isRealAI:true', { provider: service.provider, model })

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

        return NextResponse.json({ ok: true, prompt: generatedPrompt, provider: service.provider, model, autoTopUp })
      } catch (e: any) {
        const msg = e?.message || ''
        if (msg.includes('ServiceNotExist')) {
          try { await broker.inference.acknowledgeProviderSigner(service.provider) } catch {}
        }
        // For unexpected errors on this provider, try next
        console.log('provider_error', { provider: service.provider, message: msg })
        continue
      }
    }

    return NextResponse.json({ ok: false, error: 'all-providers-failed' }, { status: 502 })
    
  } catch (error: any) {
    console.error('Prompt generation error:', error)
    return NextResponse.json(
      { error: 'unexpected', message: error.message },
      { status: 500 }
    )
  }
}