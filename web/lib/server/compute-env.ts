import { CHAIN_ID } from '../constants'
import type { JsonRpcProvider } from 'ethers'

export function getRpcUrl(): string {
  const url = process.env.OG_RPC_URL || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!url) throw new Error('RPC_URL is not configured')
  return url
}

export function getFineTuningServingAddress(): string {
  const addr = process.env.FINE_TUNING_SERVING_ADDRESS || process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS
  if (!addr) throw new Error('FINE_TUNING_SERVING_ADDRESS not set')
  return addr
}

export function getFineTuneProvider(): string {
  const addr = process.env.FINE_TUNE_PROVIDER || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER
  if (!addr) throw new Error('FINE_TUNE_PROVIDER not set')
  return addr
}

export function getPrivateKey(): string | undefined {
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) return undefined
  return pk.startsWith('0x') ? pk : `0x${pk}`
}

export function getComputeLedgerContract(): string {
  return (
    process.env.COMPUTE_LEDGER_CONTRACT ||
    process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT ||
    '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa'
  )
}

export function getComputeInferenceContract(): string {
  return (
    process.env.COMPUTE_INFERENCE_CONTRACT ||
    process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT ||
    '0x5299bd255B76305ae08d7F95B270A485c6b95D54'
  )
}

export function validateComputeEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Required environment variables
  const rpcUrl = process.env.OG_RPC_URL || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpcUrl) {
    errors.push('Missing OG_RPC_URL or NEXT_PUBLIC_0G_RPC_URL')
  } else if (!rpcUrl.startsWith('http')) {
    errors.push('RPC_URL must be a valid HTTP/HTTPS URL')
  }

  const serving = process.env.FINE_TUNING_SERVING_ADDRESS || process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS
  if (!serving) {
    errors.push('Missing FINE_TUNING_SERVING_ADDRESS')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(serving)) {
    errors.push('FINE_TUNING_SERVING_ADDRESS must be a valid Ethereum address')
  }

  const provider = process.env.FINE_TUNE_PROVIDER || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER
  if (!provider) {
    errors.push('Missing FINE_TUNE_PROVIDER')
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(provider)) {
    errors.push('FINE_TUNE_PROVIDER must be a valid Ethereum address')
  }

  const ledger = getComputeLedgerContract()
  if (!/^0x[a-fA-F0-9]{40}$/.test(ledger)) {
    errors.push('COMPUTE_LEDGER_CONTRACT must be a valid Ethereum address')
  }

  const inference = getComputeInferenceContract()
  if (!/^0x[a-fA-F0-9]{40}$/.test(inference)) {
    errors.push('COMPUTE_INFERENCE_CONTRACT must be a valid Ethereum address')
  }

  // Private key validation
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) {
    warnings.push('OG_COMPUTE_PRIVATE_KEY not set - some operations will fail')
  } else if (!/^(0x)?[a-fA-F0-9]{64}$/.test(pk)) {
    errors.push('OG_COMPUTE_PRIVATE_KEY must be 64 hex characters')
  }

  // Feature flags
  const useLedger = process.env.FINE_TUNE_USE_LEDGER === 'true'
  if (useLedger) {
    warnings.push('FINE_TUNE_USE_LEDGER=true - using legacy Ledger contract (not recommended)')
  }

  return { isValid: errors.length === 0, errors, warnings }
}

export function logEnvironmentStatus(): void {
  const validation = validateComputeEnvironment()
  const rpcUrl = getRpcUrl()
  
  // Use configured chain ID instead of guessing from URL
  const configuredChainId = process.env.NEXT_PUBLIC_0G_CHAIN_ID || CHAIN_ID.toString()
  const chainId = configuredChainId === '16601' ? 'galileo-testnet-v3' : `chain-${configuredChainId}`
  
  console.log('[compute-env] Environment validation:', {
    isValid: validation.isValid,
    chainId: configuredChainId,
    chainName: chainId,
    rpcUrl,
    contracts: {
      serving: process.env.FINE_TUNING_SERVING_ADDRESS || process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS,
      ledger: getComputeLedgerContract(),
      inference: getComputeInferenceContract()
    },
    provider: process.env.FINE_TUNE_PROVIDER || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER,
    hasPrivateKey: !!process.env.OG_COMPUTE_PRIVATE_KEY
  })

  if (validation.errors.length > 0) {
    console.error('[compute-env] Environment errors:', validation.errors)
  }
  
  if (validation.warnings.length > 0) {
    console.warn('[compute-env] Environment warnings:', validation.warnings)
  }
}

export async function validateRPCConnection(): Promise<{ isValid: boolean; error?: string; chainId?: number }> {
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(getRpcUrl(), { name: '0g', chainId: CHAIN_ID })
    
    // Try to get network info with timeout
    let network: any
    try {
      network = await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network call timeout')), 5000)
        )
      ])
    } catch (networkError: any) {
      console.warn('[compute-env] RPC network call failed, using configured chainId:', networkError.message)
      // Return configured chainId if RPC fails
      const configuredChainId = process.env.NEXT_PUBLIC_0G_CHAIN_ID ? 
        parseInt(process.env.NEXT_PUBLIC_0G_CHAIN_ID) : CHAIN_ID
      return { 
        isValid: true, 
        chainId: configuredChainId,
        error: `RPC unavailable, using configured chainId: ${configuredChainId}`
      }
    }
    
    const chainId = Number(network.chainId)
    return { isValid: chainId === CHAIN_ID, chainId, error: chainId === CHAIN_ID ? undefined : `Unexpected chainId ${chainId}` }
  } catch (e: any) {
    // If everything fails, use configured chainId
    const configuredChainId = process.env.NEXT_PUBLIC_0G_CHAIN_ID ? 
      parseInt(process.env.NEXT_PUBLIC_0G_CHAIN_ID) : CHAIN_ID
    return { 
      isValid: false, 
      chainId: configuredChainId,
      error: `Validation failed, using configured chainId ${configuredChainId}: ${e.message}` 
    }
  }
}

export async function validateWalletSetup(): Promise<{ isValid: boolean; error?: string }> {
  const pk = getPrivateKey()
  if (!pk) return { isValid: false, error: 'OG_COMPUTE_PRIVATE_KEY not set' }
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(getRpcUrl(), { name: '0g', chainId: CHAIN_ID })
    const wallet = new ethers.Wallet(pk, provider)
    await wallet.getAddress()
    return { isValid: true }
  } catch (e: any) {
    return { isValid: false, error: e.message }
  }
}

export const COMPUTE_CONFIG = {
  get rpcUrl() { return getRpcUrl() },
  get fineTuningServing() { return getFineTuningServingAddress() },
  get fineTuneProvider() { return getFineTuneProvider() },
  get privateKey() { return getPrivateKey() },
  get chainId() { return CHAIN_ID },
  get ledgerContract() { return getComputeLedgerContract() },
  get inferenceContract() { return getComputeInferenceContract() },
  validate: validateComputeEnvironment
}

export { CHAIN_ID }
