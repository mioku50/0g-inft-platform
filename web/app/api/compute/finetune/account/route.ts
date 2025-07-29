import { NextRequest, NextResponse } from 'next/server'
import { formatEther, parseEther } from 'ethers'
import { getBroker, getServingContract } from '@/lib/compute/broker'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

const FINE_TUNE_PROVIDER = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER!
if (!FINE_TUNE_PROVIDER) throw new Error('NEXT_PUBLIC_FINE_TUNE_PROVIDER is not set')

export const runtime = 'nodejs'

type FineTuneAccountResponse = {
  exists: boolean
  balance: string
  pendingRefund: string
  deliverables: number
  nonce?: string
  provider: string
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
    console.error('[compute/finetune/account][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors,
      warnings: envValidation.warnings,
      diagnostics: generateResponseDiagnostics('GET')
    }, { status: 503 })
  }

  try {
    const broker = await getBroker()
    const serving = getServingContract(broker.signer)

    // Check if Fine-Tune sub-account exists for the provider
    const exists = await serving.accountExists(broker.signer.address, FINE_TUNE_PROVIDER)

    let balance = '0', pendingRefund = '0', deliverables = 0, nonce: string | undefined
    if (exists) {
      const acc = await serving.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
      balance = formatEther(acc.balance)
      pendingRefund = formatEther(acc.pendingRefund)
      deliverables = acc.deliverables?.length ?? 0
      nonce = acc.nonce?.toString()
    }

    // Also check main ledger balance
    let ledgerBalance = '0'
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      ledgerBalance = formatEther(ledgerInfo[0])
    } catch (error) {
      console.log('[fine] No main ledger account')
    }

    return NextResponse.json({
      result: {
        exists,
        balance,
        pendingRefund,
        deliverables,
        nonce,
        provider: FINE_TUNE_PROVIDER,
        ledgerBalance,
        needsAccount: !exists,
        insufficientLedgerBalance: parseFloat(ledgerBalance) < 0.001
      }
    })
  } catch (error: any) {
    console.error('[compute/finetune/account][GET] Error:', error.message)
    return NextResponse.json({
      error: 'Failed to fetch Fine-Tune account info',
      details: error.message,
      diagnostics: generateResponseDiagnostics('GET', error)
    }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/finetune/account][POST] Environment validation failed:', envValidation.errors)
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
    const serving = getServingContract(broker.signer)

    // Pre-validation: Check main ledger balance
    let ledgerBalance = '0'
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      ledgerBalance = formatEther(ledgerInfo[0])
      console.log('[fine] Main ledger balance:', ledgerBalance, 'OG')
    } catch (error) {
      return NextResponse.json({ 
        error: 'NoLedgerAccount',
        details: 'Create a main ledger account first at /api/compute/account',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    if (parseFloat(ledgerBalance) < parseFloat(amount)) {
      return NextResponse.json({ 
        error: 'InsufficientLedgerBalance',
        details: `Main ledger balance (${ledgerBalance} OG) is less than requested amount (${amount} OG)`,
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 402 })
    }

    // Check Fine-Tune sub-account status
    const accountExists = await serving.accountExists(broker.signer.address, FINE_TUNE_PROVIDER)

    if (action === 'create' && accountExists) {
      return NextResponse.json({ 
        error: 'FineTuneAccountExists',
        details: 'Fine-Tune account already exists for this provider. Use action="deposit" to add funds.',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    if (action === 'deposit' && !accountExists) {
      return NextResponse.json({ 
        error: 'FineTuneAccountNotExists', 
        details: 'Fine-Tune account does not exist for this provider. Use action="create" first.',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    console.log(`[fine] ${action}FineTuneAccount:start`, { 
      user: broker.signer.address, 
      provider: FINE_TUNE_PROVIDER,
      amount: amount + ' OG',
      accountExists
    })

    // Execute transaction
    const value = parseEther(amount)
    let tx: any

    if (action === 'create') {
      // Create new Fine-Tune sub-account
      console.log('[fine] Creating Fine-Tune sub-account...')
      tx = await serving.addAccount(
        broker.signer.address,
        FINE_TUNE_PROVIDER,
        '', // additionalInfo
        { value }
      )
    } else {
      // Deposit to existing Fine-Tune sub-account
      console.log('[fine] Depositing to Fine-Tune sub-account...')
      tx = await serving.depositFund(
        broker.signer.address,
        FINE_TUNE_PROVIDER,
        0n, // cancelRetrievingAmount
        { value }
      )
    }

    console.log(`[fine] ${action}FineTuneAccount:tx-sent`, { hash: tx.hash })

    // Wait for confirmation
    const receipt = await tx.wait(1)
    console.log(`[fine] ${action}FineTuneAccount:confirmed`, { 
      status: receipt.status,
      blockNumber: receipt.blockNumber 
    })

    // Get updated account info
    const updatedAccount = await serving.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
    const newBalance = formatEther(updatedAccount.balance)

    return NextResponse.json({
      success: true,
      action,
      txHash: tx.hash,
      explorerUrl: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
      status: 'confirmed',
      newBalance,
      provider: FINE_TUNE_PROVIDER,
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 201 })

  } catch (e: any) {
    const msg = e.message || 'Transaction failed'
    console.error(`[fine] ${action}FineTuneAccount:error`, { error: msg, stack: e.stack })
    
    // Enhanced error categorization
    if (msg.includes('AccountExists')) {
      return NextResponse.json({ 
        error: 'FineTuneAccountExists',
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
    
    // Generic contract/network errors
    return NextResponse.json({ 
      error: 'TransactionFailed',
      details: msg,
      diagnostics: generateResponseDiagnostics('POST', e)
    }, { status: 502 })
  }
}