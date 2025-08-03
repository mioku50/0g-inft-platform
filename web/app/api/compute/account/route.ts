import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker, getLedgerContract, getServingContract } from '@/lib/compute/broker.server'
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

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const providerAddress = searchParams.get('provider')
    
    const broker = await getBroker()
    
    // Enhanced account checking with provider support as per requirements
    let exists = false
    let balance = '0'
    let locked = '0'
    let explicitErrors: string[] = []
    let needsTopUp = true
    const minRequired = '0.001' // Minimum 0.001 OG required for fine-tuning
    
    try {
      if (providerAddress) {
        console.log(`[compute/account][GET] Checking account for provider: ${providerAddress}`)
        
        // Check provider-specific account using serving contract
        const serving = getServingContract(broker.signer)
        try {
          const accountExists = await serving.accountExists(broker.signer.address, providerAddress)
          exists = accountExists
          
          if (exists) {
            const accountInfo = await serving.getAccount(broker.signer.address, providerAddress)
            balance = formatEther(accountInfo.balance)
            console.log(`[compute/account][GET] Provider account found:`, { 
              provider: providerAddress, 
              balance, 
              deliverables: accountInfo.deliverables?.length || 0 
            })
          } else {
            console.log(`[compute/account][GET] No account found for provider: ${providerAddress}`)
          }
        } catch (providerError: any) {
          console.warn(`[compute/account][GET] Provider account check failed:`, providerError.message)
          explicitErrors.push(`Provider account check failed: ${providerError.message}`)
          
          // Fall back to ledger account check
          console.log(`[compute/account][GET] Falling back to ledger account check`)
        }
      }
      
      // If provider check failed or no provider specified, check ledger account
      if (!exists && !providerAddress) {
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
          }
          console.log('[compute/account][GET] Ledger account found:', { balance, locked })
        } catch (ledgerError: any) {
          console.log('[compute/account][GET] No ledger account found:', ledgerError.message)
          explicitErrors.push(`Ledger account check failed: ${ledgerError.message}`)
        }
      }
      
      // Calculate needsTopUp based on minimum required
      needsTopUp = !exists || parseFloat(balance) < parseFloat(minRequired)
      
    } catch (accountError: any) {
      console.error('[compute/account][GET] Account check error:', accountError.message)
      explicitErrors.push(`Account validation failed: ${accountError.message}`)
    }

    // Enhanced response format as per requirements
    const response = {
      exists,
      balance,
      balanceWei: exists ? undefined : '0',
      locked: locked || '0',
      pendingRefund: '0',
      pendingRefundWei: undefined,
      needsTopUp,
      minRequired,
      explicitErrors: explicitErrors.length > 0 ? explicitErrors : undefined,
      deliverables: 0, // Fine-tune specific, handled separately
      nonce: undefined,
      provider: providerAddress || undefined
    }

    console.log(`[compute/account][GET] Response:`, {
      exists, 
      balance, 
      needsTopUp, 
      minRequired,
      provider: providerAddress,
      errorCount: explicitErrors.length
    })

    return NextResponse.json({
      result: response,
      diagnostics: generateResponseDiagnostics('GET')
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

  const { amount, action = 'create', provider } = requestData

  // Enhanced parameter validation
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

    // Check current account status using SDK
    let hasLedgerAccount = false
    let currentBalance = '0'
    
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      hasLedgerAccount = true
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        currentBalance = formatEther(ledgerInfo.ledgerInfo[0])
        console.log('[compute/account][POST] Existing ledger account found:', {
          balance: currentBalance,
          locked: formatEther(ledgerInfo.ledgerInfo[1])
        })
      } else {
        currentBalance = formatEther(ledgerInfo[0])
        console.log('[compute/account][POST] Existing ledger account found:', {
          balance: currentBalance,
          locked: formatEther(ledgerInfo[1])
        })
      }
    } catch (error) {
      console.log('[compute/account][POST] No ledger account found')
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

    console.log(`[compute/account][POST] ${action}Ledger:start`, { 
      user: broker.signer.address, 
      amount: amount + ' OG',
      hasLedgerAccount,
      currentBalance,
      provider: provider || 'none'
    })

    // Execute transaction using SDK ledger methods
    let result: any
    const amountOG = parseFloat(amount) // SDK expects number in OG, not BigInt in wei
    
    if (action === 'create') {
      // Create new ledger account
      console.log('[compute/account][POST] Creating new ledger account...')
      await broker.ledger.addLedger(amountOG)
      result = { status: 'completed' }
      
      // If provider specified, acknowledge provider after account creation (with retry)
      if (provider) {
        console.log(`[compute/account][POST] Acknowledging provider after account creation: ${provider}`)
        await acknowledgeProviderWithRetry(broker, provider, 3)
      }
    } else {
      // Deposit to existing ledger account
      console.log('[compute/account][POST] Depositing to existing ledger account...')
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
    console.log(`[compute/account][POST] ${action}Ledger:success`, { 
      newBalance,
      previousBalance: currentBalance,
      increase: (parseFloat(newBalance) - parseFloat(currentBalance)).toFixed(6),
      provider: provider || 'none'
    })

    return NextResponse.json({
      success: true,
      action,
      previousBalance: currentBalance,
      newBalance,
      deposited: amount,
      status: 'completed',
      provider: provider || undefined,
      diagnostics: generateResponseDiagnostics('POST')
    }, { status: 201 })

  } catch (e: any) {
    const msg = e.message || 'Transaction failed'
    console.error(`[compute/account][POST] ${action}Ledger:error`, { error: msg, stack: e.stack })
    
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

/**
 * Acknowledge provider with retry logic (silent retry 3x as per requirements)
 */
async function acknowledgeProviderWithRetry(broker: any, provider: string, maxRetries: number = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[compute/account] Acknowledging provider ${provider} (attempt ${attempt}/${maxRetries})`)
      await broker.inference.acknowledgeProviderSigner(provider)
      console.log(`[compute/account] Provider ${provider} acknowledged successfully`)
      return
    } catch (error: any) {
      console.warn(`[compute/account] Provider acknowledgment attempt ${attempt}/${maxRetries} failed:`, error.message)
      
      if (attempt === maxRetries) {
        console.error(`[compute/account] Failed to acknowledge provider ${provider} after ${maxRetries} attempts`)
        // Don't throw - this is a "silent retry" as per requirements
      } else {
        // Wait before retry (exponential backoff)
        const delayMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.log(`[compute/account] Waiting ${delayMs}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
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
