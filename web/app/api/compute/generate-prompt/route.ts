// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK, ensureLedgerBalance, acknowledgeProviderIfNeeded, LEDGER_DECIMALS } from '@/lib/compute/broker'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { getServerProvider } from '@/lib/server/provider'
import { promises as fs } from 'fs'
import path from 'path'
import { fetchWithRetry } from '@/lib/net/fetchWithRetry'

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

        // Env-configurable networking
        const fetchTimeoutMs = Number(process.env.INFERENCE_FETCH_TIMEOUT_MS || process.env.NEXT_PUBLIC_INFERENCE_FETCH_TIMEOUT_MS || '12000') || 12000
        const fetchRetries = Number(process.env.INFERENCE_FETCH_RETRIES || process.env.NEXT_PUBLIC_INFERENCE_FETCH_RETRIES || '1')
        const maxAttempts = Math.max(1, (Number.isFinite(fetchRetries) ? Number(fetchRetries) : 1) + 1)
        const headersTtlMs = Number(process.env.INFERENCE_HEADERS_TTL_MS || '10000') || 10000

        const baseUrl = `${endpoint}/chat/completions`
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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

        // Attempt loop with header TTL refresh and retry on 5xx/429/network
        let lastHeadersAt = Date.now()
        let lastStatus: number | undefined
        let lastErr: string | undefined

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          // Refresh headers if TTL expired or previous status was 5xx/429
          const shouldRefreshHeaders = attempt > 1 && (
            (Date.now() - lastHeadersAt > headersTtlMs) ||
            (typeof lastStatus === 'number' && (lastStatus === 429 || lastStatus >= 500))
          )
          if (shouldRefreshHeaders) {
            try {
              headers = await broker.inference.getRequestHeaders(service.provider, userDescription || 'generate-system-prompt')
              lastHeadersAt = Date.now()
            } catch (e) {
              // Best-effort; keep previous headers
            }
          }

          // Whitelisted headers for logs
          const safeHeaderLog: Record<string, string | undefined> = {
            'x-og-ledger-owner': headerKeys['x-og-ledger-owner'],
            'x-og-model': headerKeys['x-og-model'] || model,
            'x-og-endpoint': headerKeys['x-og-endpoint'] || endpoint
          }

          console.log('provider_attempt', {
            provider: service.provider,
            model,
            attempt,
            url: baseUrl,
            endpoint,
            timeoutMs: fetchTimeoutMs,
            headers: safeHeaderLog
          })

          const result = await fetchWithRetry(
            baseUrl,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify(buildBody())
            },
            { retries: 0, timeoutMs: fetchTimeoutMs }
          )

          lastStatus = result.status
          lastErr = result.err

          if (result.ok) {
            const rawText = String(result.bodyText || '')
            const snippet = rawText.slice(0, 200)
            console.log(`prov=${service.provider} status=${200} len=${rawText.length} body_snippet=${JSON.stringify(snippet)}`)

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
          }

          // Handle 400 insufficient balance → auto top-up and single retry with forced new headers
          if (result.status === 400) {
            const rawText = String(result.bodyText || '')
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
              lastHeadersAt = Date.now()

              // Second attempt (only once) after top-up
              const retryAfterTopUp = await fetchWithRetry(
                baseUrl,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...headers },
                  body: JSON.stringify(buildBody())
                },
                { retries: 0, timeoutMs: fetchTimeoutMs }
              )
              const raw2 = String(retryAfterTopUp.bodyText || '')
              const snippet2 = raw2.slice(0, 200)
              console.log(`prov=${service.provider} status=${retryAfterTopUp.status} len=${raw2.length} body_snippet=${JSON.stringify(snippet2)}`)

              if (retryAfterTopUp.ok) {
                let data2: any = null
                try { data2 = JSON.parse(raw2) } catch (e: any) {
                  return NextResponse.json({ ok: false, error: 'invalid_json', details: e?.message }, { status: 502 })
                }
                const generatedPrompt2 = data2?.choices?.[0]?.message?.content
                if (!generatedPrompt2 || typeof generatedPrompt2 !== 'string') {
                  return NextResponse.json({ ok: false, error: 'invalid_response' }, { status: 502 })
                }
                try {
                  if (service?.verifiability) {
                    await broker.inference.processResponse(service.provider, generatedPrompt2, data2?.id)
                  }
                } catch {}
                try {
                  const promptsDir = path.join(process.cwd(), 'data', 'prompts')
                  await fs.mkdir(promptsDir, { recursive: true })
                  const tokenIdNum = Number(tokenIdRaw)
                  const filePath = path.join(promptsDir, `${tokenIdNum}.json`)
                  const payload = { prompt: generatedPrompt2, updatedAt: Date.now() }
                  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
                } catch {}
                return NextResponse.json({ ok: true, prompt: generatedPrompt2, provider: service.provider, model, autoTopUp })
              }

              if (retryAfterTopUp.status === 400 && /insufficient balance/i.test(raw2)) {
                return NextResponse.json({ ok: false, error: 'insufficient_balance', reason: 'provider_fee_exceeds_balance', need: Number(feeOG.toFixed(4)), payee, autoTopUp: true }, { status: 402 })
              }

              // If still not ok and not 400, fall through to generic handling below
              lastStatus = retryAfterTopUp.status
              lastErr = retryAfterTopUp.err
            }
          }

          // Network error or timeout
          if (result.status === 0) {
            console.log('provider_attempt_result', { provider: service.provider, attempt, url: baseUrl, network_err: lastErr })
            if (attempt < maxAttempts) {
              await sleep(800 * Math.max(1, attempt))
              continue
            }
            return NextResponse.json({ ok: false, error: 'network_unreachable' }, { status: 502 })
          }

          // 429/5xx handling with retry
          if (result.status === 429 || result.status >= 500) {
            console.log('provider_attempt_result', { provider: service.provider, attempt, url: baseUrl, status: result.status })
            if (attempt < maxAttempts) {
              const waitMs = (result.status === 429 && typeof result.retryAfterMs === 'number') ? result.retryAfterMs : (800 * Math.max(1, attempt))
              if (waitMs > 0) await sleep(waitMs)
              continue
            }
            const code = result.status === 429 ? 'provider_http_429' : 'provider_http_5xx'
            const httpStatus = result.status === 429 ? 429 : 502
            return NextResponse.json({ ok: false, error: code }, { status: httpStatus })
          }

          // Other 4xx (do not retry)
          if (result.status >= 400 && result.status < 500) {
            const code = `provider_http_${result.status}`
            const snippet = String(result.bodyText || '').slice(0, 200)
            console.log(`prov=${service.provider} status=${result.status} len=${(result.bodyText || '').length} body_snippet=${JSON.stringify(snippet)}`)
            return NextResponse.json({ ok: false, error: code }, { status: result.status })
          }

          // Unexpected non-ok case
          const code = `provider_http_${result.status}`
          return NextResponse.json({ ok: false, error: code }, { status: 502 })
        }

        // If we exhausted attempts without returning, treat as network
        return NextResponse.json({ ok: false, error: 'network_unreachable' }, { status: 502 })
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