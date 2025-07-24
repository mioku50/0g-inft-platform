import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { toWei, fromWei } from '@/lib/constants'
import { FINE_TUNE_PROVIDER } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

type AccountResponse = {
  exists: boolean
  balance: string
  pendingRefund: string
  needsTopUp: boolean
}

export async function GET(request: NextRequest) {
  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e) {
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
    const balance = acc ? acc.balance : '0'
    const pendingRefund = acc ? acc.pendingRefund : '0'
    const result: AccountResponse = {
      exists,
      balance,
      pendingRefund,
      needsTopUp: parseFloat(balance) < 0.001
    }
    console.log('[fine-tune][GET]', { result })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[fine-tune][GET][error]', error)
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
  const body = await request.json()
  console.log('[fine-tune][POST]', { body })
  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e) {
    console.error('[compute/account][POST] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  try {
    const { amount } = body as { amount: string }
    if (!amount || isNaN(+amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    let tx
    try {
      tx = await broker.fineTuning.addAccount(
        signerAddress,
        FINE_TUNE_PROVIDER,
        'INFT Platform User',
        { value: toWei(amount) }
      )
    } catch (e: any) {
      if (e.message?.includes('AccountExists')) {
        tx = await broker.fineTuning.depositFund(
          signerAddress,
          FINE_TUNE_PROVIDER,
          0n,
          { value: toWei(amount) }
        )
      } else {
        throw e
      }
    }
    const acc = await broker.fineTuning.getAccount(signerAddress, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash, balance: acc.balance }
    console.log('[fine-tune][POST]', { result })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[fine-tune][POST][error]', e)
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
  console.log('[fine-tune][DELETE]')
  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e) {
    console.error('[compute/account][DELETE] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  try {
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    const tx = await broker.fineTuning.requestRefundAll(signerAddress, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash }
    console.log('[fine-tune][DELETE]', { result })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[fine-tune][DELETE][error]', e)
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
