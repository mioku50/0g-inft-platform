import { NextRequest, NextResponse } from 'next/server'
import { formatEther } from 'ethers'
import { getBroker } from '@/lib/compute/broker'
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

    // Check if Fine-Tune sub-account exists for the provider using SDK
    let exists = false
    let balance = '0', pendingRefund = '0', deliverables = 0, nonce: string | undefined
    
    try {
      const acc = await broker.fineTuning.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
      exists = true
      balance = formatEther(acc.balance)
      pendingRefund = formatEther(acc.pendingRefund)
      deliverables = acc.deliverables?.length ?? 0
      nonce = acc.nonce?.toString()
    } catch (error) {
      // Account doesn't exist yet
      console.log('[fine] Fine-Tune sub-account not found for provider:', FINE_TUNE_PROVIDER)
    }

    // Also check main ledger balance
    let ledgerBalance = '0'
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        ledgerBalance = formatEther(ledgerInfo.ledgerInfo[0])
      } else {
        ledgerBalance = formatEther(ledgerInfo[0])
      }
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
  return NextResponse.json({
    error: 'MethodNotSupported',
    details: 'Fine-Tune sub-accounts are created automatically when tasks are submitted. Use the main ledger account (/api/compute/account) to manage funds.',
    suggestion: 'Create a Fine-Tune task to automatically create the sub-account, or manage funds through the main ledger.',
    diagnostics: generateResponseDiagnostics('POST')
  }, { status: 405 })
}