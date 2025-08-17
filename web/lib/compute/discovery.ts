/**
 * Broker-first discovery module for 0G Compute Network
 * Implements clean discovery through SDK without OG_PROVIDERS dependency
 */

import { ethers, Wallet } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { getRpcUrl, getPrivateKey } from '@/lib/server/compute-env'
import { withRetry } from '@/lib/chain/eth'

export interface ServiceProvider {
  provider: string
  model: string
  serviceType: string
  url: string
  inputPrice: string
  outputPrice: string
  verifiability: string
  isVerifiable: boolean
}

export interface DiscoveryResult {
  count: number
  services: ServiceProvider[]
  source: 'broker' | 'env-fallback'
  timestamp: string
}

/**
 * Create custodial broker instance for server-side discovery
 */
export async function makeBroker() {
  try {
    const rpcUrl = getRpcUrl()
    const privateKey = getPrivateKey()
    
    if (!privateKey) {
      throw new Error('OG_COMPUTE_PRIVATE_KEY not configured')
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new Wallet(privateKey, provider)
    
    console.log(`[discovery] Creating broker with wallet: ${wallet.address}`)
    
    const broker = await createZGComputeNetworkBroker(wallet)
    
    console.log('[discovery] Broker created successfully')
    return broker
  } catch (error: any) {
    console.error('[discovery] Failed to create broker:', error.message)
    throw new Error(`Broker creation failed: ${error.message}`)
  }
}

/**
 * Primary discovery path - get services via broker SDK
 */
export async function discoverViaBroker(): Promise<ServiceProvider[]> {
  try {
    console.log('[discovery] Starting broker-based service discovery...')
    
    const broker = await makeBroker()
    
    if (!broker.inference || typeof broker.inference.listService !== 'function') {
      throw new Error('Broker inference service not available')
    }
    
    const services = await withRetry(
      () => broker.inference.listService(),
      { tries: 3, baseMs: 1000 }
    )
    
    console.log(`[discovery] Found ${services.length} services from broker`)
    
    const providers: ServiceProvider[] = services.map((service: any) => ({
      provider: service.provider,
      model: service.model || 'unknown',
      serviceType: service.serviceType || 'inference',
      url: service.url || '',
      inputPrice: service.inputPrice?.toString() || '0',
      outputPrice: service.outputPrice?.toString() || '0',
      verifiability: service.verifiability || '',
      isVerifiable: service.verifiability === 'TeeML'
    }))
    
    // Acknowledge each provider automatically (broker-first approach)
    for (const provider of providers) {
      try {
        console.log(`[discovery] Acknowledging provider: ${provider.provider}`)
        await broker.inference.acknowledgeProviderSigner(provider.provider)
      } catch (ackError: any) {
        console.warn(`[discovery] Failed to acknowledge ${provider.provider}:`, ackError.message)
        // Don't fail discovery for ACK errors - continue with other providers
      }
    }
    
    return providers
  } catch (error: any) {
    console.error('[discovery] Broker discovery failed:', error.message)
    throw error
  }
}

/**
 * Fallback discovery path - use environment seeds as backup
 * Only used when broker returns empty or fails
 */
export function discoverFromEnv(): ServiceProvider[] {
  console.log('[discovery] Using fallback environment providers...')
  
  const envVar = process.env.OG_PROVIDERS || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER
  
  let providers: ServiceProvider[] = []
  
  // Parse OG_PROVIDERS if provided
  if (envVar) {
    try {
      providers = parseProviderEnv(envVar)
      console.log(`[discovery] Parsed ${providers.length} providers from env`)
    } catch (parseError: any) {
      console.warn('[discovery] Failed to parse OG_PROVIDERS:', parseError.message)
    }
  }
  
  // If no providers from env, use hardcoded official ones as last resort
  if (providers.length === 0) {
    console.log('[discovery] Using hardcoded official providers as last resort')
    providers = getOfficialProviders()
  }
  
  return providers
}

/**
 * Parse OG_PROVIDERS environment variable (soft parsing, no crashes)
 */
function parseProviderEnv(envVar: string): ServiceProvider[] {
  const trimmed = envVar.trim()
  
  // Try JSON format
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          provider: item.provider || '',
          model: item.model || 'unknown',
          serviceType: item.serviceType || 'inference',
          url: item.url || '',
          inputPrice: item.inputPrice?.toString() || '0',
          outputPrice: item.outputPrice?.toString() || '0',
          verifiability: item.verifiability || '',
          isVerifiable: item.verifiability === 'TeeML'
        }))
      }
    } catch (e: any) {
      console.warn('[discovery] JSON parsing failed, trying CSV format')
    }
  }
  
  // CSV format: provider,provider or provider:model,provider:model
  const entries = trimmed.split(',').map(s => s.trim()).filter(Boolean)
  const providers: ServiceProvider[] = []
  
  for (const entry of entries) {
    if (entry.startsWith('0x') && entry.length >= 40) {
      const [providerAddr, model] = entry.split(':')
      providers.push({
        provider: providerAddr,
        model: model || 'unknown',
        serviceType: 'inference',
        url: '',
        inputPrice: '0',
        outputPrice: '0',
        verifiability: '',
        isVerifiable: false
      })
    }
  }
  
  return providers
}

/**
 * Get official 0G providers as absolute fallback
 */
function getOfficialProviders(): ServiceProvider[] {
  return [
    {
      provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      model: 'llama-3.3-70b-instruct',
      serviceType: 'inference',
      url: '',
      inputPrice: '0',
      outputPrice: '0',
      verifiability: 'TeeML',
      isVerifiable: true
    },
    {
      provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
      model: 'deepseek-r1-70b',
      serviceType: 'inference',
      url: '',
      inputPrice: '0',
      outputPrice: '0',
      verifiability: 'TeeML',
      isVerifiable: true
    }
  ]
}

/**
 * Main discovery function - broker-first with env fallback
 */
export async function discoverServices(): Promise<DiscoveryResult> {
  const timestamp = new Date().toISOString()
  
  try {
    // Primary path: broker discovery
    const services = await discoverViaBroker()
    
    if (services.length > 0) {
      console.log(`[discovery] Success: Found ${services.length} services via broker`)
      return {
        count: services.length,
        services,
        source: 'broker',
        timestamp
      }
    }
    
    console.log('[discovery] Broker returned empty, falling back to env...')
  } catch (brokerError: any) {
    console.warn('[discovery] Broker discovery failed, falling back to env:', brokerError.message)
  }
  
  // Fallback path: environment providers
  const fallbackServices = discoverFromEnv()
  
  console.log(`[discovery] Fallback: Using ${fallbackServices.length} providers from env`)
  
  return {
    count: fallbackServices.length,
    services: fallbackServices,
    source: 'env-fallback',
    timestamp
  }
}