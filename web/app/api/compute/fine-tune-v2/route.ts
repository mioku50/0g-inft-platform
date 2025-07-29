// app/api/compute/fine-tune-v2/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { FineTuneServiceV2 } from '@/lib/compute/fine-tune-service-v2'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { getFineTuneProvider, validateComputeEnvironment } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * GET /api/compute/fine-tune-v2/providers - Получение списка провайдеров
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  // Validate environment
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune-v2][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[fine-tune-v2][GET] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }

  const service = new FineTuneServiceV2(broker)

  try {
    switch (action) {
      case 'providers':
        const providers = await service.listProviders()
        return NextResponse.json({ providers })
      
      case 'models':
        const provider = searchParams.get('provider') || getFineTuneProvider()
        const models = await service.listModels(provider)
        return NextResponse.json(models)
      
      case 'model-usage':
        const modelProvider = searchParams.get('provider') || getFineTuneProvider()
        const modelName = searchParams.get('model')
        if (!modelName) {
          return NextResponse.json({ error: 'Model name required' }, { status: 400 })
        }
        const usage = await service.getModelUsage(modelProvider, modelName)
        return NextResponse.json({ usage })
      
      case 'task-status':
        const taskProvider = searchParams.get('provider') || getFineTuneProvider()
        const taskId = searchParams.get('taskId')
        if (!taskId) {
          return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }
        const status = await service.getTaskStatus(taskProvider, taskId)
        return NextResponse.json(status)
      
      case 'task-logs':
        const logProvider = searchParams.get('provider') || getFineTuneProvider()
        const logTaskId = searchParams.get('taskId')
        if (!logTaskId) {
          return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
        }
        const logs = await service.getTaskLogs(logProvider, logTaskId)
        return NextResponse.json({ logs })
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('[fine-tune-v2][GET] error:', error)
    return NextResponse.json({
      error: 'Operation failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * POST /api/compute/fine-tune-v2 - Создание задачи или расчет токенов
 */
export async function POST(request: NextRequest) {
  // Validate environment
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[fine-tune-v2][POST] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[fine-tune-v2][POST] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }

  const signerAddress = getSignerAddress(broker)
  if (!signerAddress) {
    return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
  }

  const service = new FineTuneServiceV2(broker)

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'calculate-tokens': {
        const { model, datasetContent, provider } = body
        if (!model || !datasetContent) {
          return NextResponse.json({ 
            error: 'Model and dataset content required' 
          }, { status: 400 })
        }
        
        const tokenSize = await service.calculateTokenSize(model, datasetContent, provider)
        return NextResponse.json({ 
          tokenSize,
          dataSize: tokenSize // For compatibility
        })
      }

      case 'create-task': {
        const { 
          provider = getFineTuneProvider(),
          model,
          datasetHash,
          dataSize,
          trainingConfig
        } = body

        if (!model || !datasetHash) {
          return NextResponse.json({ 
            error: 'Model and dataset hash required' 
          }, { status: 400 })
        }

        // Проверяем аккаунт
        const exists = await broker.fineTuning.accountExists(signerAddress, provider)
        if (!exists) {
          return NextResponse.json({
            error: 'Fine-tune account not found. Please create an account first.',
            provider
          }, { status: 400 })
        }

        // Проверяем баланс
        const acc = await broker.fineTuning.getAccount(signerAddress, provider)
        const balance = parseFloat(acc.balance)
        
        // Рассчитываем требуемый баланс на основе размера данных
        const requiredBalance = dataSize ? dataSize * 0.000000000000000001 : 0.001
        
        if (balance < requiredBalance) {
          return NextResponse.json({
            error: 'Insufficient balance for fine-tuning',
            currentBalance: balance,
            requiredBalance: requiredBalance.toString()
          }, { status: 400 })
        }

        // Создаем задачу
        const taskId = await service.createTask({
          provider,
          model,
          datasetHash,
          configPath: trainingConfig,
          dataSize: dataSize || 0
        })

        return NextResponse.json({
          success: true,
          taskId,
          provider,
          message: 'Fine-tuning task created successfully',
          estimatedTime: '30-60 minutes'
        })
      }

      case 'acknowledge-model': {
        const { provider = getFineTuneProvider() } = body
        
        const modelHash = await service.acknowledgeModel(provider)
        
        return NextResponse.json({
          success: true,
          modelHash,
          message: 'Model acknowledged successfully'
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('[fine-tune-v2][POST] error:', error)
    
    const msg = error.message
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json({
      error: 'Operation failed',
      details: msg || 'Unknown error'
    }, { status: 500 })
  }
}