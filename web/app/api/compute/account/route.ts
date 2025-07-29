import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker, getLedgerContract, getServingContract, addAccountWithDeposit, deposit } from '@/lib/compute/broker'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

const FINE_TUNE_PROVIDER = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER!
if (!FINE_TUNE_PROVIDER) throw new Error('NEXT_PUBLIC_FINE_TUNE_PROVIDER is not set')

export const runtime = 'nodejs'

type AccountResponse = {
  exists: boolean
  balance: string
  balanceWei: string
  pendingRefund: string
  pendingRefundWei: string
  needsTopUp: boolean
  deliverables?: any[]
  nonce?: string
}

function formatTxUrl(hash: string): string {
  return `https://chainscan-galileo.0g.ai/tx/${hash}`
}

function generateResponseDiagnostics(method: string, error?: any) {
  return {
    method,
    timestamp: new Date().toISOString(),
    provider: FINE_TUNE_PROVIDER,
    error: error ? {
      message: error.message,
      type: error.constructor.name
    } : undefined
  }
}

export async function GET() {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings,
      diagnostics: generateResponseDiagnostics('GET')
    }, { status: 503 })
  }

  try {
    const broker = await getBroker()
    
    // Check ledger account using SDK
    let exists = false
    let balance = '0'
    let locked = '0'
    
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      exists = true
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        balance = formatEther(ledgerInfo.ledgerInfo[0])
        locked = formatEther(ledgerInfo.ledgerInfo[1])
      } else {
        balance = formatEther(ledgerInfo[0])
        locked = formatEther(ledgerInfo[1])
      }
      console.log('[fine] Ledger account found:', { balance, locked })
    } catch (error) {
      console.log('[fine] No ledger account found')
    }

    return NextResponse.json({
      result: {
        exists,
        balance,
        balanceWei: exists ? undefined : '0',
        locked,
        pendingRefund: '0', // SDK ledger doesn't have separate pendingRefund
        pendingRefundWei: undefined,
        needsTopUp: !exists || parseFloat(balance) < 0.001,
        deliverables: 0, // Fine-tune specific, handled separately
        nonce: undefined
      }
    })
  } catch (error: any) {
    console.error('[compute/account][GET] Error:', error.message)
    return NextResponse.json({
      error: 'Failed to fetch account info',
      details: error.message,
      diagnostics: generateResponseDiagnostics('GET', error)
    }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings,
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 503 })
  }

  let requestData: any
  try {
    requestData = await req.json()
  } catch {
    return NextResponse.json({ 
      error: 'Invalid JSON in request body',
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 400 })
  }

  const { amount, action = 'create' } = requestData

  // Parameter validation
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ 
      error: 'Invalid amount parameter',
      details: 'Amount must be a positive number',
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 422 })
  }
  if (action !== 'create' && action !== 'deposit') {
    return NextResponse.json({ 
      error: 'Invalid action parameter',
      details: 'Action must be "create" or "deposit"',
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 422 })
  }

  try {
    const broker = await getBroker()
    const ledger = getLedgerContract(broker.signer)
    const serving = getServingContract(broker.signer)

    // Check ledger account status using SDK
    let hasLedgerAccount = false
    let currentBalance = '0'
    
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      hasLedgerAccount = true
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        currentBalance = formatEther(ledgerInfo.ledgerInfo[0])
        console.log('[fine] Existing ledger account found:', {
          balance: currentBalance,
          locked: formatEther(ledgerInfo.ledgerInfo[1])
        })
      } else {
        currentBalance = formatEther(ledgerInfo[0])
        console.log('[fine] Existing ledger account found:', {
          balance: currentBalance,
          locked: formatEther(ledgerInfo[1])
        })
      }
    } catch (error) {
      console.log('[fine] No ledger account found')
    }

    // Validate action against account status
    if (action === 'create' && hasLedgerAccount) {
      return NextResponse.json({ 
        error: 'LedgerExists',
        details: `Ledger already exists with balance: ${currentBalance} OG. Use action="deposit" to add funds.`,
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    if (action === 'deposit' && !hasLedgerAccount) {
      return NextResponse.json({ 
        error: 'LedgerNotExists', 
        details: 'Ledger account does not exist. Use action="create" first.',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    console.log(`[fine] ${action}Ledger:start`, { 
      user: broker.signer.address, 
      amount: amount + ' OG',
      hasLedgerAccount,
      currentBalance
    })

    // Execute transaction using SDK ledger methods
    let result: any
    const amountOG = parseFloat(amount) // SDK expects number in OG, not BigInt in wei
    
    if (action === 'create') {
      // Create new ledger account
      console.log('[fine] Creating new ledger account...')
      await broker.ledger.addLedger(amountOG)
      result = { status: 'completed' }
    } else {
      // Deposit to existing ledger account
      console.log('[fine] Depositing to existing ledger account...')
      await broker.ledger.depositFund(amountOG)
      result = { status: 'completed' }
    }

    // Verify the operation by checking new balance
    const newLedgerInfo = await broker.ledger.getLedger()
    let newBalance: string
    // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
    if (newLedgerInfo.ledgerInfo) {
      newBalance = formatEther(newLedgerInfo.ledgerInfo[0])
    } else {
      newBalance = formatEther(newLedgerInfo[0])
    }
    console.log(`[fine] ${action}Ledger:success`, { 
      newBalance,
      previousBalance: currentBalance,
      increase: (parseFloat(newBalance) - parseFloat(currentBalance)).toFixed(6)
    })

    return NextResponse.json({
      success: true,
      action,
      previousBalance: currentBalance,
      newBalance,
      deposited: amount,
      status: 'completed',
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 201 })

  } catch (e: any) {
    const msg = e.message || 'Transaction failed'
    console.error(`[fine] ${action}Ledger:error`, { error: msg, stack: e.stack })
    
    // Enhanced error categorization
    if (msg.includes('Ledger already exists')) {
      return NextResponse.json({ 
        error: 'LedgerExists',
        details: msg,
        diagnostics: generateResponseDiagnostics('POST', e)
      }, { status: 409 })
    }
    
    if (/insufficient funds/i.test(msg) || msg === 'InsufficientBalance') {
      return NextResponse.json({ 
        error: 'InsufficientBalance',
        details: 'Insufficient wallet balance for this transaction',
        diagnostics: generateResponseDiagnostics('POST', e)
      }, { status: 402 })
    }
    
    if (/require\(false\)|execution reverted|contract validation failed/i.test(msg)) {
      return NextResponse.json({ 
        error: 'ContractValidationFailed', 
        details: 'The contract rejected the transaction.',
        reason: msg,
        diagnostics: generateResponseDiagnostics('POST', e)
      }, { status: 502 })
    }
    
    // Generic contract/network errors
    return NextResponse.json({ 
      error: 'TransactionFailed',
      details: msg,
      diagnostics: generateResponseDiagnostics('POST', e)
    }, { status: 502 })
  }
}

export async function DELETE() {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][DELETE] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings,
      diagnostics: generateResponseDiagnostics('DELETE')
    }, { status: 503 })
  }

  try {
    const broker = await getBroker()
    const result = await broker.fineTuning.requestRefundAll(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )
    
    console.log('[fine] requestRefundAll result:', result)

    return NextResponse.json({ 
      success: true, 
      message: 'Refund request submitted', 
      txHash: result.txHash,
      explorerUrl: result.txUrl,
      status: result.status,
      diagnostics: generateResponseDiagnostics('DELETE')
    })
  } catch (error: any) {
    console.error('[compute/account][DELETE] Error:', error.message)
    return NextResponse.json({
      error: 'Failed to submit refund request',
      details: error.message,
      diagnostics: generateResponseDiagnostics('DELETE', error)
    }, { status: 502 })
  }
}
