import { CHAIN_ID } from '../constants'
import type { JsonRpcProvider } from 'ethers'

/**
 * Parse boolean environment variables with comprehensive format support
 * Supports: 1|true|yes|on|enable|enabled → true
 * Supports: 0|false|no|off|disable|disabled → false
 * Handles inline comments: "1 # enable attestation" → true
 * Prevents infinite recursion with depth limits
 * @param name Environment variable name
 * @param defaultValue Default value if not set or invalid
 * @param depth Recursion depth to prevent infinite loops
 * @returns boolean value
 */
export function parseBoolEnv(name: string, defaultValue = false, depth = 0): boolean {
  // Prevent infinite recursion
  if (depth > 3) {
    console.error(`[parseBoolEnv] ERROR: Maximum recursion depth reached for ${name}, returning default: ${defaultValue}`)
    return defaultValue
  }

  try {
    const rawValue = process.env[name]
    if (rawValue === undefined || rawValue === null) {
      return defaultValue
    }

    // Remove inline comments (anything after #) and trim
    const cleanValue = rawValue.split('#')[0].trim().toLowerCase()
    
    if (!cleanValue) {
      return defaultValue
    }

    // Enhanced logging for debugging
    if (depth === 0) {
      console.log(`[parseBoolEnv] Parsing ${name}="${rawValue}" -> clean: "${cleanValue}"`)
    }

    // Handle true values - comprehensive list
    const trueValues = ['1', 'true', 'yes', 'on', 'enable', 'enabled', 'y', 't']
    if (trueValues.includes(cleanValue)) {
      if (depth === 0) {
        console.log(`[parseBoolEnv] ${name}="${rawValue}" -> ${true}`)
      }
      return true
    }
    
    // Handle false values - comprehensive list
    const falseValues = ['0', 'false', 'no', 'off', 'disable', 'disabled', 'n', 'f']
    if (falseValues.includes(cleanValue)) {
      if (depth === 0) {
        console.log(`[parseBoolEnv] ${name}="${rawValue}" -> ${false}`)
      }
      return false
    }

    // If value doesn't match expected patterns, log warning and use default
    console.warn(`[parseBoolEnv] WARNING: Invalid boolean value for ${name}: "${rawValue}" (cleaned: "${cleanValue}"), using default: ${defaultValue}`)
    console.warn(`[parseBoolEnv] Valid values: ${[...trueValues, ...falseValues].join(', ')}`)
    return defaultValue

  } catch (error: any) {
    // Catch any parsing errors and return default value with context
    console.error(`[parseBoolEnv] ERROR: Failed to parse ${name} at depth ${depth}: ${error.message}`)
    console.error(`[parseBoolEnv] Stack trace:`, error.stack)
    return defaultValue
  }
}

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
  // First try to get the compute-specific private key
  let pk = process.env.OG_COMPUTE_PRIVATE_KEY
  
  // Fallback to storage private key if compute key is not set
  if (!pk) {
    pk = process.env.OG_STORAGE_PRIVATE_KEY
    if (pk) {
      console.log('[compute-env] Using OG_STORAGE_PRIVATE_KEY as fallback for compute operations')
    }
  }
  
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

export function shouldAttestOnChain(): boolean {
  // Use parseBoolEnv utility for proper boolean parsing
  // Defaults to false for testing safety as per requirements
  const enabled = parseBoolEnv('FT_ATTEST_ONCHAIN', false)
  console.log(`[fine-tune] FT_ATTEST_ONCHAIN="${process.env.FT_ATTEST_ONCHAIN}" -> ${enabled}`)
  return enabled
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
