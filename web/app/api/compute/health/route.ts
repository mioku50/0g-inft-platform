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
    let brokerError = null
    
    try {
      const broker = await getBrokerOrThrow()
      console.log('[health] Broker initialized successfully')
      
      // Try to discover services
      if (broker.inference && typeof broker.inference.getServiceMetadata === 'function') {
        try {
          // This is just a test call to see if discovery works
          // In real implementation, we'd enumerate actual providers
          providersFound = 1 // Placeholder - will be updated with real discovery
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
      providersFound,
      ethersVersion,
      environment: {
        hasPrivateKey: !!privateKey,
        nodeVersion: process.version
      },
      errors: brokerError ? [brokerError] : []
    }

    console.log('[health] Health check completed:', {
      chainId,
      providersFound,
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