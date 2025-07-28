import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
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

export async function GET(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/account][GET] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const user = getSignerAddress(broker)
    if (!user) throw new Error('Signer not initialized')

    const svc = broker.fineTuning
    const provider = FINE_TUNE_PROVIDER

    const exists = await svc.accountExists(user, provider)
    let balance = '0', pendingRefund = '0', deliverables = 0, nonce: string | undefined
    let acc: any = null
    if (exists) {
      acc = await svc.getAccount(user, provider)
      balance = ethers.formatEther(acc.balance ?? '0')
      pendingRefund = ethers.formatEther(acc.pendingRefund ?? '0')
      deliverables = acc?.deliverables?.length || 0
      nonce = acc?.nonce?.toString?.()
    }

    return NextResponse.json({
      result: {
        exists,
        balance,
        balanceWei: exists ? acc.balance : '0',
        pendingRefund,
        pendingRefundWei: exists ? acc.pendingRefund : '0',
        needsTopUp: Number(balance) < 0.001,
        deliverables,
        nonce
      }
    })
    
  } catch (error: any) {
    console.error('[compute/account][GET][error]', error)
    const msg = error.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  const body = await request.json()
  console.log('[compute/account][POST]', { body })
  
  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/account][POST] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const { amount, action } = body as { amount: string; action?: string }
    
    if (!amount || isNaN(+amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    
    const exists = await broker.fineTuning.accountExists(signerAddress, FINE_TUNE_PROVIDER)
    let receipt
    const value = ethers.parseEther(amount)
    if (!exists || action === 'create') {
      receipt = await broker.fineTuning.addAccount(
        signerAddress,
        FINE_TUNE_PROVIDER,
        'INFT Platform User',
        { value }
      )
    } else {
      receipt = await broker.fineTuning.depositFund(
        signerAddress,
        FINE_TUNE_PROVIDER,
        0n,
        { value }
      )
    }
    return NextResponse.json({ success: true, txHash: receipt?.hash ?? receipt?.transactionHash })
    
  } catch (e: any) {
    console.error('[compute/account][POST][error]', e)
    const msg = e.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/account][DELETE] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  console.log('[compute/account][DELETE]')
  
  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/account][DELETE] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    
    const tx = await broker.fineTuning.requestRefundAll(signerAddress, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash }
    
    console.log('[compute/account][DELETE]', { result })
    return NextResponse.json(result)
    
  } catch (e: any) {
    console.error('[compute/account][DELETE][error]', e)
    const msg = e.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
