// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';
}

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getBrokerOrThrow } from '@/lib/compute/broker'

interface ProviderInfo {
  provider: string
  service?: string
  meta?: any
}

interface DiscoveryResponse {
  brokerServices: ProviderInfo[]
  envServices: ProviderInfo[]
  ackEligible: ProviderInfo[]
  timestamp: string
}

/**
 * GET /api/compute/discover - Diagnostic provider discovery endpoint
 * Returns what's found by broker and what's parsed from env
 */
export async function GET() {
  try {
    console.log('[discover] Starting provider discovery diagnostic...')
    
    const result: DiscoveryResponse = {
      brokerServices: [],
      envServices: [],
      ackEligible: [],
      timestamp: new Date().toISOString()
    }

    // 1. Get services from broker
    try {
      const broker = await getBrokerOrThrow()
      console.log('[discover] Broker initialized, discovering services...')
      
      if (broker.inference && typeof broker.inference.listService === 'function') {
        const services = await broker.inference.listService()
        console.log(`[discover] Found ${services.length} services from broker`)
        
        result.brokerServices = services.map((service: any) => ({
          provider: service.provider,
          service: service.serviceType || 'inference',
          meta: {
            url: service.url,
            model: service.model,
            verifiability: service.verifiability,
            inputPrice: service.inputPrice?.toString(),
            outputPrice: service.outputPrice?.toString()
          }
        }))
      } else {
        console.warn('[discover] Broker inference methods not available')
      }
    } catch (e: any) {
      console.error('[discover] Broker service discovery failed:', e.message)
    }

    // 2. Parse providers from environment variables
    try {
      const envProviders = parseProvidersFromEnv()
      console.log(`[discover] Parsed ${envProviders.length} providers from env`)
      result.envServices = envProviders
    } catch (e: any) {
      console.error('[discover] Env provider parsing failed:', e.message)
    }

    // 3. Find intersection - providers that exist in both broker and env
    const brokerProviderAddresses = new Set(
      result.brokerServices.map(s => s.provider?.toLowerCase?.() || '').filter(Boolean)
    )
    
    // prefer intersection; if none, fall back to env to keep UI usable
    const eligible = result.envServices.filter(envProvider => {
      const hasService = brokerProviderAddresses.has(envProvider.provider.toLowerCase())
      if (hasService) {
        const brokerService = result.brokerServices.find(
          bs => bs.provider.toLowerCase() === envProvider.provider.toLowerCase()
        )
        if (brokerService) {
          envProvider.meta = { ...envProvider.meta, ...brokerService.meta }
        }
      }
      return hasService
    })

    result.ackEligible = eligible.length > 0 ? eligible : result.envServices

    console.log(`[discover] Discovery completed: ${result.brokerServices.length} broker, ${result.envServices.length} env, ${result.ackEligible.length} eligible`)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[discover] Discovery failed:', error)
    
    return NextResponse.json(
      {
        error: error.message,
        timestamp: new Date().toISOString(),
        brokerServices: [],
        envServices: [],
        ackEligible: []
      },
      { status: 500 }
    )
  }
}

/**
 * Parse OG_PROVIDERS from environment variables
 * Supports both JSON array and CSV formats:
 * 
 * JSON: OG_PROVIDERS='[{"provider":"0xABC...","service":"0xSERVICE..."},{"provider":"0xDEF...","service":"0xSERVICE2..."}]'
 * CSV: OG_PROVIDERS=0xABC...:0xSERVICE...,0xDEF...:0xSERVICE2...
 * Simple: OG_PROVIDERS=0xABC...,0xDEF...
 */
function parseProvidersFromEnv(): ProviderInfo[] {
  const envVar = process.env.OG_PROVIDERS || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || ''
  
  if (!envVar) {
    console.log('[discover] No OG_PROVIDERS found in env, using defaults')
    return [
      {
        provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
        service: 'inference',
        meta: { model: 'llama-3.3-70b-instruct', source: 'default' }
      },
      {
        provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
        service: 'inference', 
        meta: { model: 'deepseek-r1-70b', source: 'default' }
      }
    ]
  }

  const trimmed = envVar.trim()
  
  // Try JSON format first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        console.log('[discover] Parsed JSON format OG_PROVIDERS')
        return parsed.map((item: any) => ({
          provider: item.provider,
          service: item.service || 'inference',
          meta: { ...item, source: 'env-json' }
        }))
      }
    } catch (e: any) {
      console.warn('[discover] Failed to parse JSON format, trying CSV:', e.message)
    }
  }

  // CSV format: provider:service,provider:service or just provider,provider
  const providers: ProviderInfo[] = []
  const entries = trimmed.split(',').map(s => s.trim()).filter(Boolean)
  
  for (const entry of entries) {
    if (entry.includes(':')) {
      // Format: provider:service
      const [provider, service] = entry.split(':').map(s => s.trim())
      if (provider && service) {
        providers.push({
          provider,
          service,
          meta: { source: 'env-csv-with-service' }
        })
      }
    } else {
      // Format: just provider address
      if (entry.startsWith('0x') && entry.length >= 40) {
        providers.push({
          provider: entry,
          service: 'inference',
          meta: { source: 'env-csv-simple' }
        })
      }
    }
  }

  console.log(`[discover] Parsed CSV format: ${providers.length} providers`)
  return providers
}