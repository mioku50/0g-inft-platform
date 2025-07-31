import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'

export async function GET(request: NextRequest) {
  try {
    const broker = await getBroker()
    if (!broker) {
      return NextResponse.json({ error: 'Failed to initialize broker' }, { status: 500 })
    }

    // Get account information using real 0G SDK
    try {
      const { balance, error } = await broker.ledgerSafe.get()
      
      if (error) {
        if (error === 'LedgerNotExists') {
          return NextResponse.json({
            success: true,
            account: {
              exists: false,
              balance: '0',
              locked: '0',
              subAccounts: []
            }
          })
        }
        throw new Error(error)
      }
      
      return NextResponse.json({
        success: true,
        account: {
          exists: true,
          balance: (Number(balance) / 1e18).toString(),
          locked: '0', // TODO: Get locked amount from SDK if available
          subAccounts: []
        }
      })
    } catch (error: any) {
      // Return account doesn't exist if it's not found
      if (error.message?.includes('LedgerNotExists') || error.message?.includes('account not found')) {
        return NextResponse.json({
          success: true,
          account: {
            exists: false,
            balance: '0',
            locked: '0',
            subAccounts: []
          }
        })
      }
      throw error
    }
  } catch (error: any) {
    console.error('Failed to get fine-tuning account:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get account' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    switch (action) {
      case 'create': {
        const initialDeposit = amount || 0.01
        await broker.ledger.addLedger(initialDeposit)
        
        return NextResponse.json({
          success: true,
          message: `Fine-tuning account created with ${initialDeposit} OG deposit`
        })
      }

      case 'deposit': {
        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Valid amount is required for deposit' }, { status: 400 })
        }
        
        await broker.ledger.depositFund(amount)
        
        return NextResponse.json({
          success: true,
          message: `Deposited ${amount} OG to Fine-tuning account`
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Failed to perform account operation:', error)
    
    // Handle specific SDK errors
    if (error.message?.includes('Ledger already exists')) {
      return NextResponse.json(
        { error: 'Account already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to perform operation' },
      { status: 500 }
    )
  }
}