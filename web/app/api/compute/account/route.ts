import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { toWei, fromWei } from '@/lib/constants'
import { FINE_TUNE_PROVIDER, validateComputeEnvironment } from '@/lib/server/compute-env'

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
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    
    const exists = await broker.fineTuning.accountExists(signerAddress, FINE_TUNE_PROVIDER)
    let acc: any = null
    
    if (exists) {
      acc = await broker.fineTuning.getAccount(signerAddress, FINE_TUNE_PROVIDER)
    }
    
    const balanceWei = acc ? acc.balanceWei : '0'
    const balance = acc ? acc.balance : '0'
    const pendingRefundWei = acc ? acc.pendingRefundWei : '0'
    const pendingRefund = acc ? acc.pendingRefund : '0'
    
    const result: AccountResponse = {
      exists,
      balance,
      balanceWei,
      pendingRefund,
      pendingRefundWei,
      needsTopUp: parseFloat(balance) < 0.001,
      deliverables: acc?.deliverables || [],
      nonce: acc?.nonce?.toString()
    }
    
    console.log('[compute/account][GET]', { result: { ...result, deliverables: result.deliverables?.length } })
    return NextResponse.json(result)
    
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
    
    let tx
    try {
      if (action === 'create') {
        // Create account with initial deposit
        tx = await broker.fineTuning.addAccount(
          signerAddress,
          FINE_TUNE_PROVIDER,
          'INFT Platform User',
          { value: toWei(amount) }
        )
      } else {
        // Try to deposit to existing account
        tx = await broker.fineTuning.depositFund(
          signerAddress,
          FINE_TUNE_PROVIDER,
          0n,
          { value: toWei(amount) }
        )
      }
    } catch (e: any) {
      if (e.message?.includes('AccountExists')) {
        // Account exists, try deposit instead
        tx = await broker.fineTuning.depositFund(
          signerAddress,
          FINE_TUNE_PROVIDER,
          0n,
          { value: toWei(amount) }
        )
      } else if (e.message?.includes('AccountNotExists')) {
        // Account doesn't exist, create it
        tx = await broker.fineTuning.addAccount(
          signerAddress,
          FINE_TUNE_PROVIDER,
          'INFT Platform User',
          { value: toWei(amount) }
        )
      } else {
        throw e
      }
    }
    
    const acc = await broker.fineTuning.getAccount(signerAddress, FINE_TUNE_PROVIDER)
    const result = { 
      success: true, 
      txHash: tx.hash, 
      balance: acc.balance,
      balanceWei: acc.balanceWei 
    }
    
    console.log('[compute/account][POST]', { result })
    return NextResponse.json(result)
    
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
