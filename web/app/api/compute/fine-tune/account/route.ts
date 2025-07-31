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
  console.log('[fine-tune/account] 🚀 Starting account info request...')
  
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune/account] ❌ Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings,
      balance: '0.0000',
      needsTopUp: true,
      exists: false
    }, { status: 503 })
  }

  if (envValidation.warnings.length > 0) {
    console.warn('[fine-tune/account] ⚠️ Environment warnings:', envValidation.warnings)
  }

  try {
    console.log('[fine-tune/account] 🔧 Creating broker...')
    const broker = await getBroker()
    
    if (!broker) {
      throw new Error('Failed to create broker instance')
    }

    if (!broker.ledger) {
      throw new Error('Broker ledger interface not available')
    }

    console.log('[fine-tune/account] 📊 Getting ledger account info...')
    
    // Get main ledger account balance
    let balance = '0.0000'
    let needsTopUp = true
    let exists = false
    let rawLedgerData = null
    
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      console.log('[fine-tune/account] 🔍 Raw ledger response:', {
        type: typeof ledgerInfo,
        isArray: Array.isArray(ledgerInfo),
        hasLedgerInfo: ledgerInfo && typeof ledgerInfo === 'object' && 'ledgerInfo' in ledgerInfo,
        keys: ledgerInfo && typeof ledgerInfo === 'object' ? Object.keys(ledgerInfo) : 'not object',
        value: ledgerInfo
      })
      
      rawLedgerData = ledgerInfo
      exists = true
      
      // Handle multiple possible formats from SDK
      let balanceWei = null
      
      if (ledgerInfo && typeof ledgerInfo === 'object') {
        // Format 1: { ledgerInfo: [balance, locked, ...] }
        if ('ledgerInfo' in ledgerInfo && Array.isArray(ledgerInfo.ledgerInfo)) {
          balanceWei = ledgerInfo.ledgerInfo[0]
          console.log('[fine-tune/account] 📈 Using format 1 (ledgerInfo array):', balanceWei)
        }
        // Format 2: Direct array [balance, locked, ...]
        else if (Array.isArray(ledgerInfo)) {
          balanceWei = ledgerInfo[0]
          console.log('[fine-tune/account] 📈 Using format 2 (direct array):', balanceWei)
        }
        // Format 3: Object with balance property
        else if ('balance' in ledgerInfo) {
          balanceWei = ledgerInfo.balance
          console.log('[fine-tune/account] 📈 Using format 3 (balance property):', balanceWei)
        }
        // Format 4: Object with amount property
        else if ('amount' in ledgerInfo) {
          balanceWei = ledgerInfo.amount
          console.log('[fine-tune/account] 📈 Using format 4 (amount property):', balanceWei)
        }
      }
      // Format 5: Direct array response
      else if (Array.isArray(ledgerInfo)) {
        balanceWei = ledgerInfo[0]
        console.log('[fine-tune/account] 📈 Using format 5 (direct array response):', balanceWei)
      }
      
      if (balanceWei !== null && balanceWei !== undefined) {
        try {
          balance = formatEther(balanceWei)
          console.log('[fine-tune/account] 💰 Formatted balance:', balance, 'OG')
        } catch (formatError) {
          console.error('[fine-tune/account] ❌ Error formatting balance:', formatError)
          console.log('[fine-tune/account] 🔍 Raw balance value:', balanceWei, typeof balanceWei)
          balance = '0.0000'
        }
      } else {
        console.warn('[fine-tune/account] ⚠️ Could not extract balance from ledger response')
        balance = '0.0000'
      }
      
      // Check if top-up is needed (less than 0.001 OG)
      const balanceFloat = parseFloat(balance)
      needsTopUp = balanceFloat < 0.001
      
      console.log('[fine-tune/account] 📋 Account summary:', {
        exists: true,
        balance: `${balance} OG`,
        balanceFloat,
        needsTopUp,
        threshold: '0.001 OG'
      })
      
    } catch (ledgerError) {
      console.log('[fine-tune/account] ℹ️ No ledger account found or error getting ledger:', ledgerError.message)
      exists = false
      balance = '0.0000'
      needsTopUp = true
    }

    const response = {
      success: true,
      balance,
      needsTopUp,
      exists,
      // Include debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          rawLedgerData,
          envValidation
        }
      })
    }

    console.log('[fine-tune/account] ✅ Returning response:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('[fine-tune/account] ❌ Critical error getting account info:', error)
    
    const errorResponse = {
      success: false,
      error: 'Failed to get account information',
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      balance: '0.0000',
      needsTopUp: true,
      exists: false,
      // Include debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          errorStack: error instanceof Error ? error.stack : 'No stack trace',
          envValidation: validateComputeEnvironment()
        }
      })
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
  }
}