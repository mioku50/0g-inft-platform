import { NextRequest, NextResponse } from 'next/server'
import { getBroker, FINE_TUNE_PROVIDER, weiToOg } from '@/lib/compute/broker'
import { parseEther } from 'ethers'

export const runtime = 'nodejs'

type AccountResponse = {
  success: true
  account: {
    exists: boolean
    balance: string
    balanceWei: string
    pendingRefund: string
    nonce: string
    deliverableCount: number
    provider: string
    address: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const broker = await getBroker()
    const exists = await broker.fineTuning.accountExists(broker.signer.address, FINE_TUNE_PROVIDER)
    let acc: any = null
    if (exists) {
      acc = await broker.fineTuning.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
    }
    const result: AccountResponse = {
      success: true,
      account: {
        exists,
        balance: acc ? weiToOg(acc.balance) : '0',
        balanceWei: acc ? acc.balance.toString() : '0',
        pendingRefund: acc ? weiToOg(acc.pendingRefund) : '0',
        nonce: acc ? acc.nonce.toString() : '0',
        deliverableCount: acc ? acc.deliverables.length : 0,
        provider: FINE_TUNE_PROVIDER,
        address: broker.signer.address
      }
    }
    console.log('[fine-tune][GET]', { result })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[fine-tune][GET][error]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  console.log('[fine-tune][POST]', { body })
  try {
    const { amount, action } = body as { amount: string; action: 'create' | 'deposit' }
    const broker = await getBroker()
    let tx
    if (action === 'create') {
      tx = await broker.fineTuning.addAccount(broker.signer.address, FINE_TUNE_PROVIDER, 'INFT Platform User', { value: parseEther(amount) })
    } else {
      tx = await broker.fineTuning.depositFund(broker.signer.address, FINE_TUNE_PROVIDER, 0n, { value: parseEther(amount) })
    }
    const acc = await broker.fineTuning.getAccount(broker.signer.address, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash, balance: weiToOg(acc.balance) }
    console.log('[fine-tune][POST]', { result })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[fine-tune][POST][error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[fine-tune][DELETE]')
  try {
    const broker = await getBroker()
    const tx = await broker.fineTuning.requestRefundAll(broker.signer.address, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash }
    console.log('[fine-tune][DELETE]', { result })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[fine-tune][DELETE][error]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
