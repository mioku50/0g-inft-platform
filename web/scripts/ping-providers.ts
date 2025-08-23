#!/usr/bin/env ts-node

import 'dotenv/config'
import dns from 'dns/promises'
import { URL } from 'url'
import { createBrokerWithEnvPK } from '../lib/compute/broker'

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: any
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`timeout>${ms}ms`)), ms)
  })
  try {
    const res = await Promise.race([p, timeout])
    return res as T
  } finally {
    clearTimeout(t)
  }
}

async function pingUrl(method: 'HEAD' | 'OPTIONS', url: string, headers?: Record<string, string>) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const resp = await fetch(url, { method, headers, signal: controller.signal })
      return { ok: true, status: resp.status }
    } finally {
      clearTimeout(timer)
    }
  } catch (e: any) {
    return { ok: false, err: e?.message || String(e) }
  }
}

function short(addr?: string) {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

async function main() {
  // Ensure sensible defaults
  process.env.NEXT_PUBLIC_0G_RPC_URL ||= process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc-testnet.0g.ai'

  const broker = await createBrokerWithEnvPK()

  // Take headers twice per requirements
  const services = await broker.inference.listService()
  console.log(`services=${services.length}`)
  for (const service of services) {
    try {
      const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
      const url = `${endpoint}/chat/completions`
      const u = new URL(url)
      const host = u.hostname

      const headers1 = await broker.inference.getRequestHeaders(service.provider, 'diagnostics-1')
      const headers2 = await broker.inference.getRequestHeaders(service.provider, 'diagnostics-2')

      console.log('\nprovider', short(service.provider))
      console.log('model', model)
      console.log('endpoint', endpoint)
      console.log('url', url)

      // DNS lookup
      try {
        const a = await withTimeout(dns.lookup(host), 3000)
        console.log('dns', { ok: true, address: a?.address, family: a?.family })
      } catch (e: any) {
        console.log('dns', { ok: false, err: e?.message || String(e) })
      }

      // OPTIONS then HEAD with 5s timeout
      const resOptions = await pingUrl('OPTIONS', url, headers1)
      console.log('options', resOptions)
      const resHead = await pingUrl('HEAD', url, headers2)
      console.log('head', resHead)
    } catch (e: any) {
      console.log('error', { provider: service?.provider, err: e?.message || String(e) })
    }
  }
}

main().catch((e) => {
  console.error('ping-providers failed:', e?.message || String(e))
  process.exit(1)
})