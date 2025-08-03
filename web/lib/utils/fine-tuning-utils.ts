/**
 * Format file size with improved display logic as per requirements
 * - Files < 1MB show in KB (not "0.00 MB")
 * - Files >= 1MB show in MB
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 bytes'
  
  // Use the requirement: < 1_000_000 bytes = < 1MB
  const oneMB = 1_000_000
  
  if (bytes < oneMB) {
    // Show in KB for files under 1MB
    const kb = bytes / 1024
    return `${kb.toFixed(1)} KB`
  } else {
    // Show in MB for files 1MB and above
    const mb = bytes / oneMB
    return `${mb.toFixed(2)} MB`
  }
}

/**
 * Validate dataset hash format and normalize if needed
 */
export function normalizeDatasetHash(hash: string): { normalized: string; valid: boolean; error?: string } {
  if (!hash) {
    return { normalized: '', valid: false, error: 'Hash is required' }
  }

  // Handle local:// format
  if (hash.startsWith('local://')) {
    const extractedHash = hash.replace('local://', '')
    if (extractedHash.match(/^[a-fA-F0-9]{64}$/)) {
      return { normalized: `0x${extractedHash}`, valid: true }
    } else {
      return { normalized: '', valid: false, error: 'Invalid hash in local:// format' }
    }
  }

  // Handle 0x format
  if (hash.startsWith('0x')) {
    if (hash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return { normalized: hash, valid: true }
    } else {
      return { normalized: '', valid: false, error: 'Invalid 0x hash format' }
    }
  }

  // Handle bare hex
  if (hash.match(/^[a-fA-F0-9]{64}$/)) {
    return { normalized: `0x${hash}`, valid: true }
  }

  return { normalized: '', valid: false, error: 'Invalid hash format' }
}

/**
 * Check if dataset is accessible via Turbo indexer
 */
export async function checkDatasetAccessibility(rootHash: string): Promise<{ accessible: boolean; status?: number; error?: string }> {
  try {
    const turboUrl = process.env.NEXT_PUBLIC_0G_STORAGE_TURBO_URL || 
                     process.env.NEXT_PUBLIC_0G_STORAGE_URL || 
                     'https://indexer-storage-testnet-turbo.0g.ai'
    
    const response = await fetch(`${turboUrl}/${rootHash}`, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    
    return { accessible: response.ok, status: response.status }
  } catch (error: any) {
    return { accessible: false, error: error.message }
  }
}

/**
 * Enhanced environment variable parsing for booleans
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue
  
  const cleanValue = value.split('#')[0].trim().toLowerCase()
  const trueValues = ['1', 'true', 'yes', 'on', 'enable', 'enabled']
  const falseValues = ['0', 'false', 'no', 'off', 'disable', 'disabled']
  
  if (trueValues.includes(cleanValue)) return true
  if (falseValues.includes(cleanValue)) return false
  
  return defaultValue
}

export default {
  formatFileSize,
  normalizeDatasetHash,
  checkDatasetAccessibility,
  parseBooleanEnv
}