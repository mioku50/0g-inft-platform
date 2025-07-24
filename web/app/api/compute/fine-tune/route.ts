// app/api/compute/fine-tune/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker, getSignerAddress } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { NATIVE_SYMBOL, FINE_TUNE_PROVIDER } from '@/lib/constants'

export const runtime = 'nodejs'

/**
 * POST /api/compute/fine-tune - Создание задачи fine-tuning
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      datasetRootHash,
      dataSize,
      baseModel,
      steps,
      learningRate
    } = body

    console.log('Fine-tuning request:', {
      agentId,
      datasetRootHash,
      baseModel,
      steps,
      learningRate
    })

    // Валидация входных данных
    if (!agentId || !datasetRootHash || !baseModel) {
      return NextResponse.json(
        { error: 'Missing required parameters: agentId, datasetRootHash, baseModel' },
        { status: 400 }
      )
    }

    // Инициализация broker и сервиса
    const broker = await getBroker()
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    const fineTuneService = new FineTuneService(broker)

    // Инициализация аккаунта (если нужно)
    try {
      await fineTuneService.initializeAccount()
    } catch (error) {
      console.warn('Account initialization warning:', error)
      // Продолжаем выполнение, аккаунт может уже существовать
    }

    // Проверка баланса
    const balance = await fineTuneService.getAccountBalance()
    console.log('Account balance:', balance, NATIVE_SYMBOL)

    if (parseFloat(balance) < 0.001) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance for fine-tuning. Please deposit funds.',
          currentBalance: balance,
          requiredMinimum: '0.001'
        },
        { status: 400 }
      )
    }

    // Создание задачи fine-tuning
    const taskId = await fineTuneService.createTask({
      agentId,
      datasetRootHash,
      baseModel,
      steps: steps || 500,
      learningRate: learningRate || 0.00005,
      dataSize
    })

    console.log('Fine-tuning task created:', taskId)

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Fine-tuning task created successfully',
      estimatedTime: '30-60 minutes'
    })

  } catch (error: any) {
    console.error('Fine-tuning creation error:', error)
    
    // Обработка специфических ошибок
    if (error.message.includes('insufficient balance')) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance for fine-tuning operation',
          details: error.message
        },
        { status: 400 }
      )
    }

    if (error.message.includes('provider not available')) {
      return NextResponse.json(
        { 
          error: 'Fine-tuning provider is currently unavailable',
          details: 'Please try again later'
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create fine-tuning task',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/compute/fine-tune?taskId=... - Получение статуса задачи
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      )
    }

    // Инициализация сервиса
    const broker = await getBroker()
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    const fineTuneService = new FineTuneService(broker)

    // Получение статуса задачи
    const status = await fineTuneService.getStatus(taskId)

    // Добавление дополнительной информации
    const response = {
      ...status,
      taskId,
      timestamp: Date.now(),
      // Добавляем полезную информацию для UI
      isCompleted: status.progress === 'Finished',
      isFailed: status.progress === 'Failed',
      isInProgress: ['Init', 'SettingUp', 'Training', 'Delivering'].includes(status.progress)
    }

    // Если задача завершена, добавляем информацию о модели
    if (status.progress === 'Finished' && status.modelRootHash) {
      ;(response as any).modelInfo = {
        rootHash: status.modelRootHash,
        downloadReady: true
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error getting fine-tuning status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get task status',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/compute/fine-tune - Подтверждение получения модели
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      )
    }

    // Инициализация сервиса
    const broker = await getBroker()
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    const fineTuneService = new FineTuneService(broker)

    // Подтверждение получения модели
    const result = await fineTuneService.acknowledge(taskId)

    return NextResponse.json({
      success: true,
      message: result,
      taskId
    })

  } catch (error: any) {
    console.error('Error acknowledging model:', error)
    return NextResponse.json(
      { 
        error: 'Failed to acknowledge model delivery',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}