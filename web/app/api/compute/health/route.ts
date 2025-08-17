// 🛠  Patch adm‑zip bug (Next.js ties process.versions to {})
if (!(process as any).versions?.node) {
  (process as any).versions ??= {};
  (process as any).versions.node = '20.11.0';
}

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { discoverServices } from '@/lib/compute/discovery'
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
    console.log('[health] Starting system health check...')
    
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: new Date().toISOString(),
      chainId: CHAIN_ID,
      contracts: {
        ledger: getComputeLedgerContract(),
        inference: getComputeInferenceContract(),
        fineTuning: getFineTuningServingAddress()
      },
      serverBalance: '0',
      providersFound: 0,
      ethersVersion: '6.x',
      flags: {
        enableSale: process.env.ENABLE_SALE === 'true',
        enableTransfer: process.env.ENABLE_TRANSFER === 'true',
        enableClone: process.env.ENABLE_CLONE === 'true',
        enableFineTune: process.env.NEXT_PUBLIC_ENABLE_FINE_TUNE === 'true'
      },
      environment: {
        hasComputeKey: !!getPrivateKey(),
        rpcUrl: getRpcUrl(),
        hasOgProviders: !!process.env.OG_PROVIDERS
      },
      services: {
        discovery: 'unknown',
        broker: 'unknown',
        rpc: 'unknown'
      }
    }

    // Test RPC connectivity
    try {
      const provider = create0GProvider()
      const blockNumber = await provider.getBlockNumber()
      health.services.rpc = 'healthy'
      console.log(`[health] RPC healthy, block: ${blockNumber}`)
    } catch (rpcError: any) {
      console.error('[health] RPC unhealthy:', rpcError.message)
      health.services.rpc = 'unhealthy'
      health.status = 'degraded'
    }

    // Test server wallet balance
    try {
      const privateKey = getPrivateKey()
      if (privateKey) {
        const provider = create0GProvider()
        const wallet = new ethers.Wallet(privateKey, provider)
        const balance = await provider.getBalance(wallet.address)
        health.serverBalance = ethers.formatEther(balance)
        console.log(`[health] Server balance: ${health.serverBalance} ETH`)
      }
    } catch (balanceError: any) {
      console.warn('[health] Could not check server balance:', balanceError.message)
    }

    // Test service discovery
    try {
      const discovery = await discoverServices()
      health.providersFound = discovery.count
      health.services.discovery = discovery.count > 0 ? 'healthy' : 'degraded'
      health.services.broker = discovery.source === 'broker' ? 'healthy' : 'degraded'
      
      console.log(`[health] Discovery: ${discovery.count} providers via ${discovery.source}`)
    } catch (discoveryError: any) {
      console.error('[health] Discovery failed:', discoveryError.message)
      health.services.discovery = 'unhealthy'
      health.services.broker = 'unhealthy'
      health.status = 'degraded'
    }

    // Overall health assessment
    if (health.services.rpc === 'unhealthy' || health.services.discovery === 'unhealthy') {
      health.status = 'unhealthy'
    } else if (health.services.rpc === 'degraded' || health.services.discovery === 'degraded') {
      health.status = 'degraded'
    }

    console.log(`[health] System status: ${health.status}`)
    
    return NextResponse.json(health)

  } catch (error: any) {
    console.error('[health] Health check failed:', error.message)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        chainId: CHAIN_ID,
        ethersVersion: '6.x'
      },
      { status: 500 }
    )
  }
}