// app/api/compute/fine-tune/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { getFineTuneProvider, validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * POST /api/compute/fine-tune - Создание задачи fine-tuning
 */
export async function POST(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/fine-tune][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/fine-tune][POST] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
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

    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    
    const fineTuneService = new FineTuneService(broker)

    // Проверяем существование аккаунта
    const exists = await broker.fineTuning.accountExists(signerAddress, getFineTuneProvider())
    if (!exists) {
      return NextResponse.json(
        { error: 'Fine-tune account not found. Please create an account first.' },
        { status: 400 }
      )
    }

    // Проверяем баланс
    const acc = await broker.fineTuning.getAccount(signerAddress, getFineTuneProvider())
    const balance = parseFloat(acc.balance)
    console.log('Account balance:', balance, NATIVE_SYMBOL)

    if (balance < 0.001) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance for fine-tuning', 
          currentBalance: acc.balance,
          requiredBalance: '0.001'
        },
        { status: 400 }
      )
    }

    // Создание задачи fine-tuning
    let taskId: string
    try {
      taskId = await fineTuneService.createTask({
        agentId,
        datasetRootHash,
        baseModel,
        steps: steps || 500,
        learningRate: learningRate || 0.00005,
        dataSize
      })
    } catch (provErr: any) {
      console.error('[fine-tune][POST] provider error', provErr)
      return NextResponse.json({ 
        error: 'Provider unavailable', 
        details: provErr.message 
      }, { status: 503 })
    }

    console.log('Fine-tuning task created:', taskId)

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Fine-tuning task created successfully',
      estimatedTime: '30-60 minutes',
      accountBalance: acc.balance
    })

  } catch (error: any) {
    console.error('Fine-tuning creation error:', error)

    const msg = error.message
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json(
      {
        error: 'Failed to create fine-tuning task',
        details: msg || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/compute/fine-tune?taskId=... - Получение статуса задачи
 */
export async function GET(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/fine-tune][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/fine-tune][GET] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      )
    }

    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    
    const fineTuneService = new FineTuneService(broker)

    // Получение статуса задачи
    const status = await fineTuneService.getStatus(taskId)

    // Добавление дополнительной информации для UI
    const response = {
      ...status,
      taskId,
      timestamp: Date.now(),
      // Статусы для удобства UI
      isCompleted: ['Finished', 'Failed'].includes(status.progress),
      isFailed: status.progress === 'Failed',
      isInProgress: ['Init', 'SettingUp', 'Training', 'Delivering'].includes(status.progress),
      isSuccessful: ['Delivered', 'Finished'].includes(status.progress),
      canAcknowledge: status.progress === 'Delivered' && !status.acknowledged
    }

    // Если задача завершена успешно, добавляем информацию о модели
    if (status.progress === 'Finished' && status.modelRootHash) {
      ;(response as any).modelInfo = {
        rootHash: status.modelRootHash,
        downloadReady: true,
        acknowledged: status.acknowledged
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error getting fine-tuning status:', error)
    const msg = error.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json(
      {
        error: 'Failed to get task status',
        details: msg || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/compute/fine-tune - Подтверждение получения модели
 */
export async function PUT(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/fine-tune][PUT] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/fine-tune][PUT] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      )
    }

    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    
    const fineTuneService = new FineTuneService(broker)

    // Проверяем статус задачи перед подтверждением
    const status = await fineTuneService.getStatus(taskId)
    if (status.progress !== 'Delivered') {
      return NextResponse.json({
        error: 'Task is not ready for acknowledgment',
        currentStatus: status.progress
      }, { status: 400 })
    }

    if (status.acknowledged) {
      return NextResponse.json({
        error: 'Task has already been acknowledged',
        taskId
      }, { status: 400 })
    }

    // Подтверждение получения модели
    const result = await fineTuneService.acknowledge(taskId)

    return NextResponse.json({
      success: true,
      message: result,
      taskId,
      status: 'Finished'
    })

  } catch (error: any) {
    console.error('Error acknowledging model:', error)
    const msg = error.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json(
      {
        error: 'Failed to acknowledge model delivery',
        details: msg || 'Unknown error'
      },
      { status: 500 }
    )
  }
}