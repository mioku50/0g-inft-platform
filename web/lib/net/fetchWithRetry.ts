export interface FetchWithRetryOptions {
  retries?: number
  timeoutMs?: number
  backoffMs?: number
  // Optional attempt callback for external logging
  onAttempt?: (info: {
    attempt: number
    url: string
    timeoutMs: number
  }) => void
}

export interface FetchWithRetryResult {
  ok: boolean
  status: number
  bodyText?: string
  err?: string
  retryAfterMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfterMs(headers: Headers | undefined): number | undefined {
  try {
    const val = headers?.get('retry-after')
    if (!val) return undefined
    const asNum = Number(val)
    if (Number.isFinite(asNum)) {
      // Seconds per RFC 7231
      return Math.max(0, Math.floor(asNum * 1000))
    }
    const asDate = Date.parse(val)
    if (!Number.isNaN(asDate)) {
      const delta = asDate - Date.now()
      return delta > 0 ? delta : 0
    }
  } catch {}
  return undefined
}

function isRetryableNetworkError(error: any): boolean {
  const msg: string = (error?.message || error?.toString?.() || '').toLowerCase()
  const code: string = (error?.code || error?.cause?.code || '').toLowerCase()
  const name: string = (error?.name || '').toLowerCase()
  const candidates = [
    'fetch failed',
    'network error',
    'socket hang up',
    'client network socket disconnected',
    'und_err_connect_timeout',
    'blocked by client',
    'dns',
    'econnreset',
    'enotfound',
    'etimedout',
    'eai_again'
  ]
  return (
    name.includes('typeerror') ||
    candidates.some((c) => msg.includes(c)) ||
    candidates.some((c) => code.includes(c))
  )
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: FetchWithRetryOptions = {}
): Promise<FetchWithRetryResult> {
  const retries = Number.isFinite(opts.retries) ? Math.max(0, Number(opts.retries)) : 1
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? Number(opts.timeoutMs) : 12000
  const backoffMs = Number.isFinite(opts.backoffMs) ? Number(opts.backoffMs) : 800

  let lastError: any = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    opts.onAttempt?.({ attempt: attempt + 1, url, timeoutMs })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const resp = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)

      const status = resp.status
      const retryAfterMs = status === 429 ? parseRetryAfterMs(resp.headers) : undefined
      const text = await resp.text().catch(() => '')

      // Successful HTTP
      if (resp.ok) {
        return { ok: true, status, bodyText: text }
      }

      // Decide whether to retry based on status
      const shouldRetry = status === 429 || status >= 500
      if (shouldRetry && attempt < retries) {
        const waitMs = retryAfterMs !== undefined ? retryAfterMs : backoffMs * Math.max(1, attempt + 1)
        if (waitMs > 0) await sleep(waitMs)
        continue
      }

      // No retry or out of attempts
      return { ok: false, status, bodyText: text, retryAfterMs }
    } catch (error: any) {
      clearTimeout(timer)
      lastError = error
      const isRetryable = isRetryableNetworkError(error)
      if (isRetryable && attempt < retries) {
        const waitMs = backoffMs * Math.max(1, attempt + 1)
        if (waitMs > 0) await sleep(waitMs)
        continue
      }
      const errStr = error?.message || String(error)
      return { ok: false, status: 0, err: errStr }
    }
  }

  // Should not reach here, but in case
  const errStr = lastError?.message || 'unknown'
  return { ok: false, status: 0, err: errStr }
}