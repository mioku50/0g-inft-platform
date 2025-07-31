import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker } from '@/lib/compute/broker.server'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune-account][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings
    }, { status: 503 })
  }

  try {
    const broker = await getBroker()
    if (!broker) {
      return NextResponse.json({ error: 'Failed to initialize broker' }, { status: 500 })
    }

    console.log('[fine-tune-account] Getting ledger balance...')

    // Get account information using real 0G SDK - use the same method as account route
    let exists = false
    let balance = '0'
    let locked = '0'
    
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      exists = true
      
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        balance = formatEther(ledgerInfo.ledgerInfo[0])
        locked = formatEther(ledgerInfo.ledgerInfo[1] || 0)
      } else if (Array.isArray(ledgerInfo)) {
        balance = formatEther(ledgerInfo[0])
        locked = formatEther(ledgerInfo[1] || 0)
      } else {
        // Handle object format
        balance = formatEther(ledgerInfo.balance || ledgerInfo.amount || 0)
        locked = formatEther(ledgerInfo.locked || 0)
      }
      
      console.log('[fine-tune-account] Ledger balance found:', { balance, locked })
    } catch (error: any) {
      console.log('[fine-tune-account] No ledger account found:', error.message)
      // Account doesn't exist, return default values
    }

    return NextResponse.json({
      success: true,
      account: {
        exists,
        balance,
        locked,
        subAccounts: []
      }
    })
  } catch (error: any) {
    console.error('[fine-tune-account] Failed to get account:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to get account',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune-account][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { action, amount } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const broker = await getBroker()
    if (!broker) {
      return NextResponse.json({ error: 'Failed to initialize broker' }, { status: 500 })
    }

    console.log(`[fine-tune-account] Performing action: ${action}`, { amount })

    switch (action) {
      case 'create': {
        const initialDeposit = amount || 0.01
        console.log(`[fine-tune-account] Creating ledger account with ${initialDeposit} OG...`)
        
        await broker.ledger.addLedger(initialDeposit)
        
        console.log('[fine-tune-account] Ledger account created successfully')
        return NextResponse.json({
          success: true,
          message: `Fine-tuning account created with ${initialDeposit} OG deposit`
        })
      }

      case 'deposit': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Valid amount is required for deposit' }, { status: 400 })
        }
        
        console.log(`[fine-tune-account] Depositing ${amount} OG to ledger account...`)
        await broker.ledger.depositFund(amount)
        
        console.log('[fine-tune-account] Deposit completed successfully')
        return NextResponse.json({
          success: true,
          message: `Deposited ${amount} OG to Fine-tuning account`
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[fine-tune-account] Failed to perform account operation:', error)
    
    // Handle specific SDK errors
    if (error.message?.includes('Ledger already exists')) {
      return NextResponse.json(
        { 
          error: 'Account already exists',
          success: false
        },
        { status: 409 }
      )
    }
    
    if (error.message?.includes('insufficient funds') || error.message?.includes('InsufficientBalance')) {
      return NextResponse.json(
        { 
          error: 'Insufficient wallet balance for this transaction',
          success: false
        },
        { status: 402 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to perform operation',
        success: false
      },
      { status: 500 }
    )
  }
}