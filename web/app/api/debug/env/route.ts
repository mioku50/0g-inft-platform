import { NextRequest, NextResponse } from 'next/server'
import { parseBoolEnv } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * Debug endpoint for environment variables
 * GET /api/debug/env?name=VARIABLE_NAME
 * 
 * Features:
 * - Returns current value of specified environment variable
 * - Supports boolean parsing for known boolean variables
 * - Feature-flagged for dev/stage environments only
 * - Helps debug FT_ATTEST_ONCHAIN and other config issues
 */
export async function GET(request: NextRequest) {
  // Feature flag: only allow in dev/stage environments
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production' && process.env.ENABLE_DEBUG_API !== '1') {
    return NextResponse.json({
      error: 'Debug API not available in production',
      details: 'Set ENABLE_DEBUG_API=1 to enable in production'
    }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const envVarName = searchParams.get('name')
    
    if (!envVarName) {
      return NextResponse.json({
        error: 'Missing required parameter: name',
        usage: 'GET /api/debug/env?name=VARIABLE_NAME',
        examples: [
          'GET /api/debug/env?name=FT_ATTEST_ONCHAIN',
          'GET /api/debug/env?name=NEXT_PUBLIC_0G_RPC_URL',
          'GET /api/debug/env?name=NODE_ENV'
        ]
      }, { status: 400 })
    }

    const rawValue = process.env[envVarName]
    
    // Known boolean environment variables for enhanced parsing
    const booleanVars = [
      'FT_ATTEST_ONCHAIN',
      'NEXT_PUBLIC_FT_ATTEST_ONCHAIN', 
      'FT_MOCK',
      'FINE_TUNE_ENABLE_PREFLIGHT_CHECK',
      'FINE_TUNE_PAUSE_METADATA_SYNC',
      'ENABLE_DEBUG_API'
    ]
    
    const result: any = {
      name: envVarName,
      rawValue: rawValue || null,
      exists: rawValue !== undefined,
      timestamp: new Date().toISOString()
    }
    
    // Enhanced parsing for boolean variables
    if (booleanVars.includes(envVarName)) {
      result.type = 'boolean'
      result.parsedValue = parseBoolEnv(envVarName, false)
      result.parseLogic = {
        trueValues: ['1', 'true', 'yes', 'on', 'enable', 'enabled'],
        falseValues: ['0', 'false', 'no', 'off', 'disable', 'disabled'],
        supportsComments: true,
        example: '1 # enable on-chain attestation'
      }
    } else {
      result.type = 'string'
      result.parsedValue = rawValue || null
    }
    
    // Add security note for sensitive variables
    const sensitiveVars = ['OG_COMPUTE_PRIVATE_KEY', 'OG_STORAGE_PRIVATE_KEY', 'PRIVATE_KEY']
    if (sensitiveVars.some(v => envVarName.includes(v))) {
      result.isSensitive = true
      result.rawValue = rawValue ? '[REDACTED - LENGTH: ' + rawValue.length + ']' : null
      result.parsedValue = null
      result.note = 'Sensitive environment variable - value hidden for security'
    }
    
    // Special handling for FT_ATTEST_ONCHAIN debugging
    if (envVarName === 'FT_ATTEST_ONCHAIN' || envVarName === 'NEXT_PUBLIC_FT_ATTEST_ONCHAIN') {
      result.debugInfo = {
        purpose: 'Controls whether fine-tuning tasks are attested on-chain',
        defaultValue: false,
        recommendation: 'Set to "1" to enable on-chain attestation',
        currentBehavior: result.parsedValue ? 'Attestation ENABLED' : 'Attestation DISABLED',
        environmentCheck: process.env.FT_ATTEST_ONCHAIN || process.env.NEXT_PUBLIC_FT_ATTEST_ONCHAIN || 'Not set'
      }
    }
    
    return NextResponse.json({
      success: true,
      environment: nodeEnv,
      debug: result
    })
    
  } catch (error: any) {
    console.error('[debug/env] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * List common environment variables for debugging
 * POST /api/debug/env (to avoid accidental exposure via GET without params)
 */
export async function POST(request: NextRequest) {
  // Feature flag check
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production' && process.env.ENABLE_DEBUG_API !== '1') {
    return NextResponse.json({
      error: 'Debug API not available in production'
    }, { status: 403 })
  }

  try {
    const commonVars = [
      'NODE_ENV',
      'NEXT_PUBLIC_0G_RPC_URL',
      'NEXT_PUBLIC_0G_CHAIN_ID',
      'NEXT_PUBLIC_0G_STORAGE_URL',
      'FT_ATTEST_ONCHAIN',
      'NEXT_PUBLIC_FT_ATTEST_ONCHAIN',
      'FT_MOCK',
      'NEXT_PUBLIC_FINE_TUNE_PROVIDER',
      'NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS',
      'NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT'
    ]
    
    const results: any = {}
    
    for (const varName of commonVars) {
      const rawValue = process.env[varName]
      const isSensitive = varName.includes('PRIVATE_KEY')
      
      results[varName] = {
        exists: rawValue !== undefined,
        rawValue: isSensitive ? (rawValue ? '[REDACTED]' : null) : (rawValue || null),
        parsedValue: varName.includes('ATTEST') || varName === 'FT_MOCK' ? 
          parseBoolEnv(varName, false) : (rawValue || null)
      }
    }
    
    return NextResponse.json({
      success: true,
      environment: nodeEnv,
      commonVariables: results,
      timestamp: new Date().toISOString(),
      note: 'Use GET /api/debug/env?name=VARIABLE_NAME for detailed info on specific variables'
    })
    
  } catch (error: any) {
    console.error('[debug/env] POST Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 })
  }
}