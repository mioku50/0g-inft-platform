/**
 * Parse boolean environment variables with comprehensive format support
 * Supports: 1|true|yes|on|enable|enabled → true
 * Supports: 0|false|no|off|disable|disabled → false
 * Handles inline comments and provides detailed logging
 */
export function parseBoolEnv(name: string, defaultValue = false, depth = 0): boolean {
  // Prevent infinite recursion
  if (depth > 3) {
    console.warn(`[parseBoolEnv] Max recursion depth reached for ${name}, returning default: ${defaultValue}`)
    return defaultValue
  }

  try {
    const rawValue = process.env[name]
    
    if (!rawValue) {
      console.log(`[parseBoolEnv] ${name}=undefined -> ${defaultValue} (default)`)
      return defaultValue
    }

    // Remove inline comments (anything after #)
    const cleanValue = rawValue.split('#')[0].trim().toLowerCase()
    
    if (!cleanValue) {
      console.log(`[parseBoolEnv] ${name}="${rawValue}" -> ${defaultValue} (empty after comment removal)`)
      return defaultValue
    }

    // True values
    const trueValues = ['1', 'true', 'yes', 'on', 'enable', 'enabled']
    // False values  
    const falseValues = ['0', 'false', 'no', 'off', 'disable', 'disabled']

    if (trueValues.includes(cleanValue)) {
      console.log(`[parseBoolEnv] ${name}="${rawValue}" -> true`)
      return true
    }
    
    if (falseValues.includes(cleanValue)) {
      console.log(`[parseBoolEnv] ${name}="${rawValue}" -> false`)
      return false
    }

    // Unknown value, use default
    console.warn(`[parseBoolEnv] ${name}="${rawValue}" -> ${defaultValue} (unknown value, using default)`)
    return defaultValue

  } catch (error) {
    console.error(`[parseBoolEnv] Error parsing ${name}:`, error)
    return defaultValue
  }
}