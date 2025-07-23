import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { ethers } from 'ethers'

export const runtime = 'nodejs'

const FINE_TUNE_PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

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
        pendingRefund: accountInfo ? ethers.utils.formatEther(accountInfo.pendingRefund || '0') : '0',
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
        await broker.fineTuning.addAccount(
          broker.signer.address,
          FINE_TUNE_PROVIDER,
          'INFT Platform User',
          { value: ethers.utils.parseEther(amount) }
        )
        message = `Account created with initial balance of ${amount} ETH`
      } catch (error: any) {
        if (error.message.includes('AccountExists')) {
          // Аккаунт уже существует, просто пополняем
          await fineTuneService.depositFunds(amount)
          message = `Account already exists. Deposited ${amount} ETH`
        } else {
          throw error
        }
      }
    } else {
      // Пополнение существующего аккаунта
      await fineTuneService.depositFunds(amount)
      message = `Deposited ${amount} ETH to existing account`
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
          details: 'Please ensure you have enough ETH in your wallet'
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
    await broker.fineTuning.requestRefundAll(
      broker.signer.address,
      FINE_TUNE_PROVIDER
    )

    return NextResponse.json({
      success: true,
      message: 'Refund request submitted. Processing may take some time.',
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