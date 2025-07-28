import { NextRequest, NextResponse } from 'next/server'
import { parseEther, formatEther } from 'ethers'
import { getBroker } from '@/lib/compute/broker'
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

export async function GET() {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

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
}

export async function POST(req: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

  const { amount, action = 'create' } = await req.json()

  const broker = await getBroker()
  const fine = broker.fineTuning

  if (action === 'create') {
    const tx = await fine.addAccount(
      broker.signer.address,
      FINE_TUNE_PROVIDER,
      'INFT Platform User',
      { value: parseEther(amount) }
    )
    console.log('[fine] addAccount tx.to:', tx.to)
    await tx.wait()
    return NextResponse.json({ success: true, message: `Account created with ${amount} ETH`, txHash: tx.hash })
  } else {
    const tx = await fine.depositFund(
      broker.signer.address,
      FINE_TUNE_PROVIDER,
      0n,
      { value: parseEther(amount) }
    )
    console.log('[fine] depositFund tx.to:', tx.to)
    await tx.wait()
    return NextResponse.json({ success: true, message: `Deposited ${amount} ETH`, txHash: tx.hash })
  }
}

export async function DELETE() {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][DELETE] Environment validation failed:', envValidation.errors)
    return NextResponse.json({
      error: 'Compute misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

  const broker = await getBroker()
  const tx = await broker.fineTuning.requestRefundAll(
    broker.signer.address,
    FINE_TUNE_PROVIDER
  )
  console.log('[fine] requestRefundAll tx.to:', tx.to)
  await tx.wait()

  return NextResponse.json({ success: true, message: 'Refund request submitted', txHash: tx.hash })
}
