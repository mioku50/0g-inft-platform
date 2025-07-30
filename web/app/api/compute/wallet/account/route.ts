// app/api/compute/wallet/account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { validateUserWallet } from '@/lib/compute/wallet-broker'
import { validateComputeEnvironment } from '@/lib/server/compute-env'
import { NATIVE_SYMBOL } from '@/lib/constants'

export const runtime = 'nodejs'

/**
 * GET /api/compute/wallet/account - Получение информации об аккаунте пользователя
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('userAddress')

    if (!userAddress) {
      return NextResponse.json({
        error: 'Missing userAddress parameter'
      }, { status: 400 })
    }

    console.log('[compute/wallet/account][GET] Getting account info for:', userAddress)

    // Validate environment
    const envValidation = validateComputeEnvironment()
    if (!envValidation.isValid) {
      return NextResponse.json({
        error: 'Compute environment misconfigured',
        details: envValidation.errors.join(', ')
      }, { status: 503 })
    }

    // For now, return mock account data
    // In a real implementation, you would:
    // 1. Query the fine-tuning contract for user's account
    // 2. Check balance and status
    // 3. Return real data

    const mockAccountInfo = {
      userAddress,
      balance: '0.05',
      exists: true,
      needsTopUp: false,
      lastActivity: new Date().toISOString(),
      totalTasks: 3,
      completedTasks: 1,
      pendingTasks: 2
    }

    console.log('[compute/wallet/account][GET] Account info:', mockAccountInfo)

    return NextResponse.json({
      success: true,
      account: mockAccountInfo
    })

  } catch (error) {
    console.error('[compute/wallet/account][GET] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to get account information',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * POST /api/compute/wallet/account - Создание/пополнение аккаунта пользователя
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, amount, action } = body

    console.log('[compute/wallet/account][POST] Request:', {
      userAddress,
      amount,
      action
    })

    // Validate required parameters
    if (!userAddress || !amount) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'userAddress and amount are required'
      }, { status: 400 })
    }

    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      }, { status: 400 })
    }

    // Validate environment
    const envValidation = validateComputeEnvironment()
    if (!envValidation.isValid) {
      return NextResponse.json({
        error: 'Compute environment misconfigured',
        details: envValidation.errors.join(', ')
      }, { status: 503 })
    }

    console.log('[compute/wallet/account][POST] User would sign transaction for:', {
      userAddress,
      amount: `${amount} ${NATIVE_SYMBOL}`,
      action: action || 'deposit',
      estimatedGas: '0.001 OG'
    })

    // For demonstration, simulate successful transaction
    // In a real implementation, you would:
    // 1. Get user's signer from the request
    // 2. Create transaction for account creation/deposit
    // 3. Let user sign the transaction
    // 4. Submit to network and wait for confirmation

    const mockTransactionHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const explorerUrl = `https://explorer-testnet.0g.ai/tx/${mockTransactionHash}`

    return NextResponse.json({
      success: true,
      message: action === 'create' ? 'Account created successfully' : 'Account funded successfully',
      transactionHash: mockTransactionHash,
      explorerUrl,
      amount: `${amount} ${NATIVE_SYMBOL}`,
      userAddress,
      action: action || 'deposit'
    })

  } catch (error) {
    console.error('[compute/wallet/account][POST] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to process account transaction',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * PUT /api/compute/wallet/account - Обновление настроек аккаунта
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, settings } = body

    if (!userAddress) {
      return NextResponse.json({
        error: 'Missing userAddress parameter'
      }, { status: 400 })
    }

    console.log('[compute/wallet/account][PUT] Updating settings for:', userAddress, settings)

    // For demonstration purposes
    return NextResponse.json({
      success: true,
      message: 'Account settings updated successfully',
      userAddress,
      settings
    })

  } catch (error) {
    console.error('[compute/wallet/account][PUT] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to update account settings',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}