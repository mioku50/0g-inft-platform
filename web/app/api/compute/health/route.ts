// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';
}

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBrokerOrThrow } from '@/lib/compute/broker'
import { 
  getRpcUrl, 
  getPrivateKey, 
  getComputeLedgerContract, 
  getComputeInferenceContract, 
  getFineTuningServingAddress,
  CHAIN_ID 
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

export async function GET() {
  try {
    console.log('[health] Starting health check...')
    
    // Get environment configuration
    const rpcUrl = getRpcUrl()
    const privateKey = getPrivateKey()
    const chainId = CHAIN_ID
    
    // Contract addresses
    const contracts = {
      ledger: getComputeLedgerContract(),
      inference: getComputeInferenceContract(),
      serving: getFineTuningServingAddress()
    }

    // Provider and wallet setup
    const provider = create0GProvider()
    let serverBalance = '0'
    let walletAddress = 'Not configured'
    
    if (privateKey) {
      try {
        const wallet = new ethers.Wallet(privateKey, provider)
        walletAddress = wallet.address
        const balanceWei = await provider.getBalance(wallet.address)
        serverBalance = ethers.formatEther(balanceWei)
      } catch (e: any) {
        console.warn('[health] Failed to get wallet balance:', e.message)
      }
    }

    // Test broker initialization and provider discovery
    let providersFound = 0
    let ackEligible = 0
    let brokerError = null
    let lastAckOkAt = null
    
    try {
      const broker = await getBrokerOrThrow()
      console.log('[health] Broker initialized successfully')
      
      // Try to discover services using the same logic as chat service
      if (broker.inference && typeof broker.inference.listService === 'function') {
        try {
          const services = await broker.inference.listService()
          providersFound = services.length
          
          // Also count ackEligible providers (from env that exist in broker)
          const envProviders = parseProvidersFromEnv()
          const brokerProviderAddresses = new Set(
            services.map((s: any) => s.provider?.toLowerCase()).filter(Boolean)
          )
          
          const eligible = envProviders.filter(envProvider => 
            brokerProviderAddresses.has(envProvider.provider.toLowerCase())
          )
          ackEligible = eligible.length
          
          if (ackEligible > 0) {
            lastAckOkAt = new Date().toISOString()
          }
          
        } catch (e: any) {
          console.warn('[health] Service discovery failed:', e.message)
        }
      }
    } catch (e: any) {
      brokerError = e.message
      console.error('[health] Broker initialization failed:', e.message)
    }

    // Ethers version
    const ethersVersion = '6.15.0' // Current version from package.json

    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      chainId,
      rpcUrl,
      contracts,
      walletAddress,
      serverBalance: `${serverBalance} OG`,
      providers: {
        brokerDiscovered: providersFound,
        envEligible: ackEligible,
        lastAckOkAt
      },
      rpc: {
        backoffCount: 0, // Would be tracked in enhanced provider
        rateLimitHits: 0 // Would be tracked in enhanced provider
      },
      cache: {
        hit: 0, // Would be tracked in cache implementation
        miss: 0 // Would be tracked in cache implementation
      },
      ethersVersion,
      environment: {
        hasPrivateKey: !!privateKey,
        nodeVersion: process.version,
        ackRequired: process.env.ACK_REQUIRED !== 'false',
        enableSale: process.env.ENABLE_SALE === 'true',
        enableTransfer: process.env.ENABLE_TRANSFER === 'true',
        enableClone: process.env.ENABLE_CLONE === 'true'
      },
      errors: brokerError ? [brokerError] : []
    }

    console.log('[health] Health check completed:', {
      chainId,
      providersFound,
      ackEligible,
      serverBalance: `${serverBalance} OG`,
      hasErrors: healthStatus.errors.length > 0
    })

    return NextResponse.json(healthStatus)

  } catch (error: any) {
    console.error('[health] Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        chainId: CHAIN_ID,
        rpcUrl: getRpcUrl()
      },
      { status: 500 }
    )
  }
}

/**
 * Parse OG_PROVIDERS from environment variables
 * Same logic as in chat-service.ts and discover endpoint
 */
function parseProvidersFromEnv(): any[] {
  const envVar = process.env.OG_PROVIDERS || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || ''
  
  if (!envVar) {
    return [
      { provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd' },
      { provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3' }
    ]
  }

  const trimmed = envVar.trim()
  
  // Try JSON format first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          provider: item.provider,
          service: item.service || 'inference'
        }))
      }
    } catch (e) {
      // Fall through to CSV parsing
    }
  }

  // CSV format
  const providers: any[] = []
  const entries = trimmed.split(',').map(s => s.trim()).filter(Boolean)
  
  for (const entry of entries) {
    if (entry.includes(':')) {
      const [provider] = entry.split(':').map(s => s.trim())
      if (provider) providers.push({ provider })
    } else if (entry.startsWith('0x') && entry.length >= 40) {
      providers.push({ provider: entry })
    }
  }

  return providers
}