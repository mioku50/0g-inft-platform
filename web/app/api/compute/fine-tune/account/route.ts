import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker } from '@/lib/compute/broker.server'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * GET /api/compute/fine-tune/account - Get Fine Tune account balance info
 * This endpoint returns both main ledger balance and fine-tune specific balance
 */
export async function GET() {
  console.log('[fine-tune/account] Getting account info...')
  
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune/account] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings
    }, { status: 503 })
  }

  try {
    const broker = await getBroker()
    
    // Get main ledger account balance
    let balance = '0.0000'
    let needsTopUp = true
    let exists = false
    
    try {
      // Explicitly pass the signer address to support both SDK versions
      const ledgerInfo = await broker.ledger.getLedger(broker.signer.address)
      exists = true
      
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        balance = formatEther(ledgerInfo.ledgerInfo[0])
        console.log('[fine-tune/account] Ledger balance (format 1):', balance)
      } else if (Array.isArray(ledgerInfo) && ledgerInfo.length > 0) {
        balance = formatEther(ledgerInfo[0])
        console.log('[fine-tune/account] Ledger balance (format 2):', balance)
      } else {
        console.log('[fine-tune/account] Unexpected ledger format:', ledgerInfo)
        balance = '0.0000'
      }
      
      needsTopUp = parseFloat(balance) < 0.001
      
    } catch (error) {
      console.log('[fine-tune/account] No ledger account found:', error)
      exists = false
      balance = '0.0000'
      needsTopUp = true
    }

    console.log('[fine-tune/account] Account info:', {
      exists,
      balance,
      needsTopUp
    })

    return NextResponse.json({
      balance,
      needsTopUp,
      exists
    })

  } catch (error) {
    console.error('[fine-tune/account] Error getting account info:', error)
    
    return NextResponse.json({
      error: 'Failed to get account info',
      details: error instanceof Error ? error.message : 'Unknown error',
      balance: '0.0000',
      needsTopUp: true,
      exists: false
    }, { status: 500 })
  }
}