// lib/utils/feature-flags.ts
export const FEATURE_FLAGS = {
  // Fine-tuning feature flags
  FT_DISABLED: process.env.NEXT_PUBLIC_FT_DISABLED === '1',
  FT_MOCK: process.env.FT_MOCK === '1',
  FT_ATTEST_ONCHAIN: process.env.FT_ATTEST_ONCHAIN === '1',
  
  // UI feature flags
  ENHANCED_UI: process.env.ENHANCED_UI !== '0', // enabled by default
  STREAMING_ENABLED: process.env.STREAMING_ENABLED !== '0', // enabled by default
  
  // Performance flags
  AGGRESSIVE_CACHING: process.env.AGGRESSIVE_CACHING === '1',
  DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]
}

export function getFeatureFlags() {
  return FEATURE_FLAGS
}

// Helper for client-side feature flag checks
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag)
}

// Environmental validation
export function validateFeatureFlags(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check if Fine-Tune is disabled but other FT flags are enabled
  if (FEATURE_FLAGS.FT_DISABLED && FEATURE_FLAGS.FT_MOCK) {
    errors.push('FT_DISABLED=1 conflicts with FT_MOCK=1 - Fine-tuning is disabled')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Debug info
export function getFeatureFlagInfo() {
  return {
    flags: FEATURE_FLAGS,
    environment: process.env.NODE_ENV,
    validation: validateFeatureFlags()
  }
}