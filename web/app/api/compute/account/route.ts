// app/api/compute/account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker, FINE_TUNE_PROVIDER } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { parseEther, formatEther } from 'ethers'
import { NATIVE_SYMBOL } from '@/lib/constants'

export const runtime = 'nodejs'

/**
 * GET /api/compute/account - Получение информации об аккаунте
 */
export async function GET(request: NextRequest) {
  try {
    const broker = await getBroker()
    const fineTuneService = new FineTuneService(broker)

    // Получение баланса
    const balance = await fineTuneService.getAccountBalance()

    // Получение полной информации об аккаунте
    let accountInfo = null
    try {
      accountInfo = await broker.fineTuning.getAccount(
        broker.signer.address,
        FINE_TUNE_PROVIDER
      )
    } catch (error) {
      console.warn('Could not fetch detailed account info:', error)
    }

    // Проверка существования аккаунта
    const accountExists = await broker.fineTuning.accountExists(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )

    const response = {
      success: true,
      account: {
        address: broker.signer.address,
        provider: FINE_TUNE_PROVIDER,
        balance: balance,
        balanceWei: accountInfo?.balance?.toString() || '0',
        exists: accountExists,
        pendingRefund: accountInfo ? formatEther(accountInfo.pendingRefund || '0') : '0',
        nonce: accountInfo?.nonce?.toString() || '0',
        deliverables: accountInfo?.deliverables || [],
        refunds: accountInfo?.refunds || []
      },
      recommendations: {
        minimumBalance: '0.001',
        recommendedBalance: '0.01',
        needsTopUp: parseFloat(balance) < 0.001
      }
    }

    return NextResponse.json(response)

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
    const fineTuneService = new FineTuneService(broker)

    let transactionHash = ''
    let message = ''

    if (action === 'create') {
      // Создание нового аккаунта
      try {
        const tx = await broker.fineTuning.addAccount(
          broker.signer.address,
          FINE_TUNE_PROVIDER,
          'INFT Platform User',
          { value: parseEther(amount) }
        )
        transactionHash = tx.hash
        message = `Account created with initial balance of ${amount} ${NATIVE_SYMBOL}`
      } catch (error: any) {
        if (error.message.includes('AccountExists')) {
          // Аккаунт уже существует, просто пополняем
          await fineTuneService.depositFunds(amount)
          message = `Account already exists. Deposited ${amount} ${NATIVE_SYMBOL}`
        } else {
          throw error
        }
      }
    } else {
      // Пополнение существующего аккаунта
      const tx = await fineTuneService.depositFunds(amount)
      transactionHash = tx?.hash || ''
      message = `Deposited ${amount} ${NATIVE_SYMBOL} to existing account`
    }

    // Получение обновленного баланса
    const newBalance = await fineTuneService.getAccountBalance()

    return NextResponse.json({
      success: true,
      message,
      transaction: transactionHash,
      account: {
        address: broker.signer.address,
        newBalance,
        depositedAmount: amount
      }
    })

  } catch (error: any) {
    console.error('Error managing account:', error)
    
    // Обработка специфических ошибок
    if (error.message.includes('insufficient funds')) {
      return NextResponse.json(
        { 
          error: 'Insufficient wallet balance for deposit',
          details: `Please ensure you have enough ${NATIVE_SYMBOL} in your wallet`
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to manage account',
        details: error.message || 'Unknown error'
      },
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

    return NextResponse.json({
      success: true,
      message: 'Refund request submitted. Processing may take some time.',
      transaction: tx?.hash || '',
      note: 'Refunds are processed automatically after the lock period expires'
    })

  } catch (error: any) {
    console.error('Error requesting refund:', error)
    return NextResponse.json(
      { 
        error: 'Failed to request refund',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}