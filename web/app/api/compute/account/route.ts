// app/api/compute/account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker, FINE_TUNE_PROVIDER } from '@/lib/compute/broker'
import { parseEther, formatEther } from 'ethers'
import { NATIVE_SYMBOL } from '@/lib/constants'

export const runtime = 'nodejs'

/**
 * GET /api/compute/account - Получение информации об аккаунте
 */
export async function GET(request: NextRequest) {
  try {
    const broker = await getBroker()
    if (!broker.signer) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }

    const exists = await broker.fineTuning.accountExists(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )

    let balance = 0n
    let nonce = 0n
    let deliverablesLen = 0

    if (exists) {
      const info = await broker.fineTuning.getAccount(
        broker.signer.address,
        FINE_TUNE_PROVIDER
      )
      balance = info.balance
      nonce = info.nonce
      deliverablesLen = info.deliverables.length
    }

    return NextResponse.json({
      exists,
      balance: formatEther(balance),
      nonce: nonce.toString(),
      deliverables: deliverablesLen
    })

  } catch (error: any) {
    console.error('Error getting account info:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get account information',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/compute/account - Создание или пополнение аккаунта
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, action = 'deposit' } = body

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be greater than 0' },
        { status: 400 }
      )
    }

    const broker = await getBroker()
    if (!broker.signer) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }

    let tx
    if (action === 'create') {
      tx = await broker.fineTuning.addAccount(
        broker.signer.address,
        FINE_TUNE_PROVIDER,
        'INFT Platform User',
        { value: parseEther(amount) }
      )
    } else {
      tx = await broker.fineTuning.depositFund(
        broker.signer.address,
        FINE_TUNE_PROVIDER,
        0n,
        { value: parseEther(amount) }
      )
    }

    const info = await broker.fineTuning.getAccount(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )

    return NextResponse.json({
      balance: formatEther(info.balance)
    })

  } catch (e: any) {
    console.error('depositFund error', {
      message: e.message,
      code: e.code,
      reason: e.reason,
      data: e.data
    })
    return NextResponse.json(
      { error: e.message, code: e.code, reason: e.reason },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/compute/account - Запрос возврата средств
 */
export async function DELETE(request: NextRequest) {
  try {
    const broker = await getBroker()

    // Запрос возврата всех доступных средств
    const tx = await broker.fineTuning.requestRefundAll(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )
    await tx.wait()

    return NextResponse.json({
      success: true,
      message: 'Refund request submitted. Processing may take some time.',
      transaction: tx?.hash || '',
      note: 'Refunds are processed automatically after the lock period expires'
    })

  } catch (e: any) {
    console.error('requestRefundAll error', {
      message: e.message,
      code: e.code,
      reason: e.reason,
      data: e.data
    })
    return NextResponse.json(
      { error: e.message, code: e.code, reason: e.reason },
      { status: 500 }
    )
  }
}