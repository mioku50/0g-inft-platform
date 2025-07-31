import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker } from '@/lib/compute/broker.server'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

const DEBUG_FINE_TUNE = process.env.DEBUG_FINE_TUNE === 'true'

/**
 * GET /api/compute/fine-tune/account - Get Fine Tune account balance info
 * This endpoint returns both main ledger balance and fine-tune specific balance
 */
export async function GET() {
  if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 🏦 Getting account info...')
  
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[ACCOUNT-API] ❌ Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings
    }, { status: 503 })
  }

  if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] ✅ Environment validation passed')

  try {
    const broker = await getBroker()
    if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] ✅ Broker initialized')
    
    // Get main ledger account balance
    let balance = '0.0000'
    let needsTopUp = true
    let exists = false
    
    try {
      if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Calling broker.ledger.getLedger()...')
      const ledgerInfo = await broker.ledger.getLedger()
      if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Raw ledger response:', ledgerInfo)
      exists = true
      
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        balance = formatEther(ledgerInfo.ledgerInfo[0])
        if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Ledger balance (format 1):', balance)
      } else if (Array.isArray(ledgerInfo) && ledgerInfo.length > 0) {
        balance = formatEther(ledgerInfo[0])
        if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Ledger balance (format 2):', balance)
      } else {
        if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Unexpected ledger format:', ledgerInfo)
        balance = '0.0000'
      }
      
      needsTopUp = parseFloat(balance) < 0.001
      
    } catch (error) {
      if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 No ledger account found:', error)
      exists = false
      balance = '0.0000'
      needsTopUp = true
    }

    if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] 📊 Account info:', {
      exists,
      balance,
      needsTopUp
    })

    const response = {
      balance,
      needsTopUp,
      exists
    }

    if (DEBUG_FINE_TUNE) console.log('[ACCOUNT-API] ✅ Returning account info:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('[ACCOUNT-API] ❌ Error getting account info:', error)
    
    return NextResponse.json({
      error: 'Failed to get account info',
      details: error instanceof Error ? error.message : 'Unknown error',
      balance: '0.0000',
      needsTopUp: true,
      exists: false
    }, { status: 500 })
  }
}