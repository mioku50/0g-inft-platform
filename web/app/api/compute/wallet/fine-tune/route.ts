// app/api/compute/wallet/fine-tune/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createUserWalletBroker } from '@/lib/compute/wallet-broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * POST /api/compute/wallet/fine-tune - Создание задачи fine-tuning с кошельком пользователя
 */
export async function POST(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/wallet/fine-tune][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const {
      agentId,
      datasetRootHash,
      dataSize,
      baseModel,
      steps,
      learningRate,
      userSignature,
      userAddress
    } = body

    console.log('Wallet fine-tuning request:', {
      agentId,
      datasetRootHash,
      baseModel,
      steps,
      learningRate,
      userAddress
    })

    // Валидация входных данных
    if (!agentId || !datasetRootHash || !baseModel || !userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: agentId, datasetRootHash, baseModel, userAddress' },
        { status: 400 }
      )
    }

    // Создание провайдера и подключение к кошельку пользователя
    const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai')
    
    // Здесь нужно получить signer от пользователя через Web3Provider
    // Это будет работать только на фронтенде с подключенным кошельком
    return NextResponse.json({
      error: 'Wallet integration required',
      message: 'This endpoint requires frontend wallet integration. Use the client-side fine-tuning flow instead.',
      instructions: {
        step1: 'Connect wallet on frontend',
        step2: 'Use wagmi/ethers to get user signer',
        step3: 'Call createUserWalletBroker with user signer',
        step4: 'Execute fine-tuning operations directly'
      }
    }, { status: 400 })

  } catch (error: any) {
    console.error('Wallet fine-tuning error:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to process wallet fine-tuning request',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/compute/wallet/fine-tune/info - Информация о требованиях для кошелька
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Wallet Fine-tuning Information',
    requirements: {
      wallet: 'Connected Web3 wallet (MetaMask, WalletConnect, etc.)',
      network: 'Galileo Testnet (Chain ID: 16601)',
      balance: 'Sufficient OG tokens for transactions',
      permissions: 'User must approve all transactions'
    },
    process: {
      step1: 'Connect wallet and verify network',
      step2: 'Upload dataset to 0G Storage (requires signature)',
      step3: 'Create/fund fine-tuning account (requires signature)', 
      step4: 'Submit fine-tuning task (requires signature)',
      step5: 'Monitor progress and acknowledge completion'
    },
    benefits: {
      security: 'User controls all private keys',
      transparency: 'All transactions visible on blockchain',
      decentralization: 'No reliance on centralized services'
    },
    currentStatus: 'Implementation in progress - currently uses server-side keys for testing'
  })
}