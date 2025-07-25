import { requireEnv } from '../constants'

// Server-only environment variables validation
export const RPC_URL = requireEnv('NEXT_PUBLIC_0G_RPC_URL')
export const FINE_TUNING_SERVING = requireEnv('NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS')
export const FINE_TUNE_PROVIDER = requireEnv('NEXT_PUBLIC_FINE_TUNE_PROVIDER')
export const PK = requireEnv('OG_COMPUTE_PRIVATE_KEY')

// Validation function for server-only usage
export function validateComputeEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  try {
    if (!RPC_URL) errors.push('Missing NEXT_PUBLIC_0G_RPC_URL')
    if (!FINE_TUNING_SERVING) errors.push('Missing NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS')
    if (!FINE_TUNE_PROVIDER) errors.push('Missing NEXT_PUBLIC_FINE_TUNE_PROVIDER')
    if (!PK) errors.push('Missing OG_COMPUTE_PRIVATE_KEY')
    
    // Additional validation
    if (RPC_URL && !RPC_URL.startsWith('http')) {
      errors.push('NEXT_PUBLIC_0G_RPC_URL must be a valid HTTP URL')
    }
    
    if (FINE_TUNING_SERVING && !FINE_TUNING_SERVING.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS must be a valid Ethereum address')
    }
    
    if (FINE_TUNE_PROVIDER && !FINE_TUNE_PROVIDER.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('NEXT_PUBLIC_FINE_TUNE_PROVIDER must be a valid Ethereum address')
    }
    
    if (PK && !PK.match(/^0x[a-fA-F0-9]{64}$/)) {
      errors.push('OG_COMPUTE_PRIVATE_KEY must be a valid private key')
    }
    
  } catch (e: any) {
    errors.push(`Environment validation error: ${e.message}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Export configuration object for easy access
export const COMPUTE_CONFIG = {
  RPC_URL,
  FINE_TUNING_SERVING,
  FINE_TUNE_PROVIDER,
  PK,
  isValid: () => validateComputeEnvironment().isValid
}
