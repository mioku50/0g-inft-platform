import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { toWei } from '@/lib/constants'
import { FINE_TUNE_PROVIDER } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

type AccountResponse = {
  exists: boolean
  balanceWei: string
  balanceOG: string
  pendingRefundOG: string
  deliverablesCount: number
}

export async function GET(request: NextRequest) {
  try {
    const broker = await getBrokerOrThrow()
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    const exists = await broker.fineTuning.accountExists(signerAddress, FINE_TUNE_PROVIDER)
    let acc: any = null
    if (exists) {
      acc = await broker.fineTuning.getAccount(signerAddress, FINE_TUNE_PROVIDER)
    }
    const result: AccountResponse = {
      exists,
      balanceWei: acc ? acc.balanceWei : '0',
      balanceOG: acc ? acc.balance : '0',
      pendingRefundOG: acc ? acc.pendingRefund : '0',
      deliverablesCount: acc ? acc.deliverables.length : 0
    }
    console.log('[fine-tune][GET]', { result })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[fine-tune][GET][error]', error)
    const status =
      error.message?.includes('Missing env') ||
      error.message?.includes('Contract not deployed') ||
      error.message?.includes('Failed to start')
        ? 503
        : 500
    return NextResponse.json({ error: error.message }, { status })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  console.log('[fine-tune][POST]', { body })
  try {
    const { amount } = body as { amount: string }
    if (!amount || isNaN(+amount) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }
    const broker = await getBrokerOrThrow()
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
    const status =
      e.message?.includes('Missing env') ||
      e.message?.includes('Contract not deployed') ||
      e.message?.includes('Failed to start')
        ? 503
        : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[fine-tune][DELETE]')
  try {
    const broker = await getBrokerOrThrow()
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) throw new Error('Signer not initialized')
    const tx = await broker.fineTuning.requestRefundAll(signerAddress, FINE_TUNE_PROVIDER)
    const result = { success: true, txHash: tx.hash }
    console.log('[fine-tune][DELETE]', { result })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[fine-tune][DELETE][error]', e)
    const status =
      e.message?.includes('Missing env') ||
      e.message?.includes('Contract not deployed') ||
      e.message?.includes('Failed to start')
        ? 503
        : 500
    return NextResponse.json({ error: e.message }, { status })
  }
}
