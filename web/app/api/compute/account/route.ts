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
    const fine = broker.fineTuning

    const exists = await fine.accountExists(broker.signer.address, FINE_TUNE_PROVIDER)

    let balance = '0', pendingRefund = '0', deliverables = 0, nonce: string | undefined
    if (exists) {
      const acc = await fine.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
      balance = formatEther(acc.balance)
      pendingRefund = formatEther(acc.pendingRefund)
      deliverables = acc.deliverables?.length ?? 0
      nonce = acc.nonce?.toString()
    }

    return NextResponse.json({
      result: {
        exists,
        balance,
        balanceWei: exists ? undefined : '0',
        pendingRefund,
        pendingRefundWei: undefined,
        needsTopUp: !exists || parseFloat(balance) < 0.001,
        deliverables,
        nonce
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

    // Pre-validation: Verify provider is registered
    try {
      const service = await serving.getService(FINE_TUNE_PROVIDER)
      if (!service || !service.url || service.url.length === 0) {
        return NextResponse.json({ 
          error: 'ProviderNotRegistered',
          details: `Fine-tuning provider ${FINE_TUNE_PROVIDER} is not properly registered`,
          diagnostics: generateResponseDiagnostics('POST')
        }, { status: 409 })
      }
    } catch (serviceError: any) {
      console.error('[compute/account][POST] Provider validation failed:', serviceError.message)
      return NextResponse.json({ 
        error: 'ProviderNotRegistered',
        details: 'Failed to validate provider registration',
        diagnostics: generateResponseDiagnostics('POST', serviceError)
      }, { status: 409 })
    }

    // Pre-validation: Check account status for action consistency
    let accountExists = false
    try {
      accountExists = await serving.accountExists(broker.signer.address, FINE_TUNE_PROVIDER)
    } catch (existsError: any) {
      console.error('[compute/account][POST] Account existence check failed:', existsError.message)
    }

    if (action === 'create' && accountExists) {
      return NextResponse.json({ 
        error: 'AccountExists',
        details: 'Account already exists. Use action="deposit" to add funds.',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    if (action === 'deposit' && !accountExists) {
      return NextResponse.json({ 
        error: 'AccountNotExists', 
        details: 'Account does not exist. Use action="create" first.',
        diagnostics: generateResponseDiagnostics('POST')
      }, { status: 409 })
    }

    console.log(`[fine] ${action}Account:start`, { 
      user: broker.signer.address, 
      provider: FINE_TUNE_PROVIDER, 
      amount: amount + ' OG',
      servingAddress: serving.target || serving.address
    })

    // Execute transaction through SDK broker (updated to use official SDK)
    const result = await broker.fineTuning.depositFund(
      broker.signer.address,
      FINE_TUNE_PROVIDER,
      0n, // cancelRetrievingAmount
      amount
    )

    console.log(`[fine] ${action}Account:success`, { txHash: result.txHash })

    return NextResponse.json({
      success: true,
      action,
      txHash: result.txHash,
      explorerUrl: result.txUrl || formatTxUrl(result.txHash),
      status: result.status,
      simulation: false,
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 201 })

  } catch (e: any) {
    const msg = e.message || 'Transaction failed'
    console.error(`[fine] ${action}Account:error`, { error: msg, stack: e.stack })
    
    // Enhanced error categorization with proper status codes
    if (msg === 'AccountExists') {
      return NextResponse.json({ 
        error: msg,
        details: 'Account already exists for this user and provider',
        diagnostics: generateResponseDiagnostics('POST', e)
      }, { status: 409 })
    }
    
    if (msg === 'AccountNotExists') {
      return NextResponse.json({ 
        error: msg,
        details: 'Account does not exist for this user and provider',
        diagnostics: generateResponseDiagnostics('POST', e)
      }, { status: 409 })
    }
    
    if (msg === 'ProviderNotExist' || msg === 'ServiceNotExist') {
      return NextResponse.json({ 
        error: 'ProviderNotExist',
        details: 'The fine-tuning provider is not registered or available',
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
        details: 'The contract rejected the transaction. This might be due to provider configuration, access control, or validation issues.',
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
