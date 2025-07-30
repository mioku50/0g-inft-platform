// app/api/compute/wallet/fine-tune/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createUserWalletBroker, validateUserWallet } from '@/lib/compute/broker.server'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { getBroker } from '@/lib/compute/broker.server'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { validateComputeEnvironment } from '@/lib/server/compute-env'
import { getModelHash } from '@/lib/compute/fine-tune-models'

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
      details: envValidation.errors.join(', ')
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { 
      agentId, 
      datasetRootHash, 
      baseModel, 
      steps, 
      learningRate, 
      dataSize,
      userAddress 
    } = body

    console.log('[compute/wallet/fine-tune][POST] Request params:', {
      agentId,
      datasetRootHash: datasetRootHash?.slice(0, 16) + '...',
      baseModel,
      steps,
      learningRate,
      dataSize,
      userAddress
    })

    // Validate required parameters
    if (!agentId || !datasetRootHash || !baseModel || !userAddress) {
      return NextResponse.json({
        error: 'Missing required parameters',
        details: 'agentId, datasetRootHash, baseModel, and userAddress are required'
      }, { status: 400 })
    }

    // Get model hash
    const modelHash = getModelHash(baseModel)
    if (!modelHash) {
      return NextResponse.json({
        error: 'Invalid model',
        details: `Model ${baseModel} not found or not supported`
      }, { status: 400 })
    }

    // For now, we'll simulate the wallet integration
    // In a real implementation, you would:
    // 1. Get the user's signer from the request (via session or signature)
    // 2. Create the broker with user's wallet
    // 3. Let the user sign the transaction

    console.log('[compute/wallet/fine-tune][POST] User wallet integration would happen here')
    console.log('[compute/wallet/fine-tune][POST] User would sign transaction for:', {
      userAddress,
      modelHash,
      estimatedCost: '0.01 OG'
    })

    // For demonstration, we'll use the server-side service but log the wallet integration
    // We need a broker instance for the service
    const broker = await getBroker()
    const fineTuneService = new FineTuneService(broker)

    // Create the fine-tuning task
    const taskId = await fineTuneService.createTask({
      agentId,
      datasetRootHash,
      baseModel,
      steps: steps || 500,
      learningRate: learningRate || 0.00005,
      dataSize
    })

    console.log('[compute/wallet/fine-tune][POST] Task created with ID:', taskId)

    if (taskId) {
      return NextResponse.json({
        success: true,
        taskId,
        message: 'Fine-tuning task created successfully',
        estimatedTime: '30-60 minutes',
        userAddress,
        modelHash
      })
    } else {
      // Task created but no ID returned
      return NextResponse.json({
        success: true,
        message: 'Fine-tuning task submitted successfully. Please check back for status updates.',
        userAddress,
        modelHash
      })
    }

  } catch (error) {
    console.error('[compute/wallet/fine-tune][POST] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to create fine-tuning task',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}

/**
 * GET /api/compute/wallet/fine-tune - Получение задач пользователя
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

    console.log('[compute/wallet/fine-tune][GET] Getting tasks for user:', userAddress)

    // For now, return mock data
    // In a real implementation, you would query the database or blockchain
    const mockTasks = [
      {
        id: 'task_1234567890abcdef',
        status: 'pending',
        agentId: '1',
        baseModel: 'llama-3.3-70b',
        createdAt: new Date().toISOString(),
        userAddress,
        progress: 0
      }
    ]

    return NextResponse.json({
      success: true,
      tasks: mockTasks,
      userAddress
    })

  } catch (error) {
    console.error('[compute/wallet/fine-tune][GET] Error:', error)
    
    return NextResponse.json({
      error: 'Failed to get user tasks',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
}