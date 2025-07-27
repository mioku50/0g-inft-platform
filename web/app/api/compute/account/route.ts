import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { fromWei } from '@/lib/constants'
import { getFineTuneProvider, validateComputeEnvironment } from '@/lib/server/compute-env'

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
    
    const exists = await broker.fineTuning.accountExists(
      signerAddress,
      getFineTuneProvider()
    )
    let acc: any = null

    if (exists) {
      acc = await broker.fineTuning.getAccount(
        signerAddress,
        getFineTuneProvider()
      )
    }

    const toBn0 = (v: any) => {
      try {
        return v == null ? 0n : BigInt(v.toString())
      } catch {
        return 0n
      }
    }

    const balanceWei = acc?.balanceWei ?? '0'
    const balance = acc?.balance ?? '0'
    const pendingRefund = acc ? fromWei(toBn0(acc.pendingRefundWei)) : '0'
    const pendingRefundWei = acc?.pendingRefundWei ?? '0'

    const result: AccountResponse = {
      exists,
      balance,
      balanceWei,
      pendingRefund,
      pendingRefundWei,
      needsTopUp: parseFloat(balance) < 0.001,
      deliverables: Array.isArray(acc?.deliverables) ? acc!.deliverables : [],
      nonce: acc?.nonce?.toString(),
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
    let message = ''
    if (action === 'create') {
      try {
        tx = await broker.fineTuning.depositFund(
          signerAddress,
          getFineTuneProvider(),
          0n,
          { value: ethers.parseEther(amount) }
        )
        message = `Deposited ${amount} ETH to existing account`
      } catch (e: any) {
        const msg = (e?.reason || e?.message || '').toString()
        if (msg.includes('AccountNotExists') || msg.includes('Account Not Exists')) {
          if (!broker.ledger?.openFineTuningAccount) {
            throw new Error('Ledger helper openFineTuningAccount is missing on broker')
          }
          tx = await broker.ledger.openFineTuningAccount(
            signerAddress,
            getFineTuneProvider(),
            { value: ethers.parseEther(amount) }
          )
          await tx.wait()
          message = `Account created via Ledger and funded with ${amount} ETH`
        } else {
          throw e
        }
      }
    } else {
      tx = await broker.fineTuning.depositFund(
        signerAddress,
        getFineTuneProvider(),
        0n,
        { value: ethers.parseEther(amount) }
      )
      message = `Deposited ${amount} ETH to existing account`
    }
    
    const acc = await broker.fineTuning.getAccount(
      signerAddress,
      getFineTuneProvider()
    )
    const result = {
      success: true,
      txHash: tx.hash,
      balance: acc.balance,
      balanceWei: acc.balanceWei,
      message,
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
    
    const tx = await broker.fineTuning.requestRefundAll(signerAddress, getFineTuneProvider())
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
