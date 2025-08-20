import 'dotenv/config'
import { ethers } from 'ethers'
import { create0GRateLimitedProvider } from '../server/rate-limited-provider'

// CJS-only broker import (никаких «иногда ESM»)
let _createZGComputeNetworkBroker: any | null = null

async function getCreateBrokerFn() {
  if (_createZGComputeNetworkBroker) return _createZGComputeNetworkBroker

  try {
    // Try dynamic import first (should resolve to CJS via alias)
    const mod: any = await import('@0glabs/0g-serving-broker')
    _createZGComputeNetworkBroker =
      mod?.createZGComputeNetworkBroker ??
      mod?.default?.createZGComputeNetworkBroker
  } catch (importError) {
    // Fallback to require if dynamic import fails
    try {
      const mod = require('@0glabs/0g-serving-broker')
      _createZGComputeNetworkBroker =
        mod?.createZGComputeNetworkBroker ??
        mod?.default?.createZGComputeNetworkBroker
    } catch (requireError) {
      throw new Error(`[broker] Failed to load createZGComputeNetworkBroker: ${importError}, ${requireError}`)
    }
  }

  if (!_createZGComputeNetworkBroker) {
    throw new Error('[broker] Failed to load createZGComputeNetworkBroker')
  }
  return _createZGComputeNetworkBroker
}

let brokerInstance: any = null

function getBrowserWalletSigner(): ethers.Signer {
  // This would be implemented for non-custodial mode
  // For now, we'll fall back to server-side signer
  throw new Error('Non-custodial wallet not available on server side')
}

// пример использования:
export async function createBroker(walletOrSigner: any, addrs: { ledger: string; inference: string; fineTuning?: string }) {
  const createZGComputeNetworkBroker = await getCreateBrokerFn()
  return createZGComputeNetworkBroker(walletOrSigner, addrs)
}

export async function getBroker() {
  if (brokerInstance) return brokerInstance
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not found')
  }
  
  const provider = create0GRateLimitedProvider()
  
  const USE_NONCUSTODIAL_INFERENCE = process.env.USE_NONCUSTODIAL_INFERENCE === 'true'
  
  const signer = USE_NONCUSTODIAL_INFERENCE
    ? getBrowserWalletSigner()
    : new ethers.Wallet(privateKey, provider) as any

  // Create broker using the new function
  brokerInstance = await createBroker(signer, {
    ledger: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT!,
    inference: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT!,
    fineTuning: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS!
  })
  
  console.log('broker created')
  return brokerInstance
}
