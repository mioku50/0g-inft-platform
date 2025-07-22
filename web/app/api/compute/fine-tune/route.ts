// web/app/api/compute/fine-tune/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { calculateTokenSize } from '@/lib/compute/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, datasetRoot, baseModel, steps, learningRate } = body
    
    console.log('Fine-tune request:', body)
    
    // Инициализируем сервисы
    const broker = await getBroker()
    const fineTuneService = new FineTuneService(broker)
    
    // Рассчитываем размер датасета
    const dataSize = await calculateTokenSize(datasetRoot, baseModel)
    console.log('Dataset size calculated:', dataSize, 'tokens')
    
    // Конфигурация обучения для 0G
    const config = {
      base_model: baseModel,
      training_steps: steps,
      learning_rate: learningRate,
      batch_size: 4,
      gradient_accumulation_steps: 4,
      warmup_steps: Math.floor(steps * 0.1),
      max_seq_length: 2048,
      save_steps: Math.floor(steps / 4),
      logging_steps: 10,
      evaluation_strategy: "steps",
      eval_steps: Math.floor(steps / 10)
    }
    
    // Создаем задачу fine-tuning
    const taskId = await fineTuneService.createTask({
      model: baseModel,
      datasetRootHash: datasetRoot,
      configPath: config,
      dataSize
    })
    
    console.log('Fine-tune task created with ID:', taskId)
    
    // Сохраняем информацию о задаче
    if (typeof window === 'undefined') {
      const fs = require('fs').promises
      const path = require('path')
      const tasksFile = path.join(process.cwd(), 'data', 'agent-tasks.json')
      
      let tasks = {}
      try {
        const content = await fs.readFile(tasksFile, 'utf-8')
        tasks = JSON.parse(content)
      } catch (e) {}
      
      if (!tasks[agentId]) tasks[agentId] = []
      tasks[agentId].push({
        taskId,
        createdAt: new Date().toISOString(),
        baseModel,
        steps,
        dataSize,
        status: 'Init'
      })
      
      await fs.mkdir(path.dirname(tasksFile), { recursive: true })
      await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2))
    }
    
    return NextResponse.json({ 
      success: true,
      taskId,
      provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      estimatedTime: '30-60 minutes',
      dataSize,
      config
    })
    
  } catch (error: any) {
    console.error('Fine-tune API error:', error)
    return NextResponse.json(
      { 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET для проверки статуса
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) {
    return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
  }
  
  try {
    const broker = await getBroker()
    const fineTuneService = new FineTuneService(broker)
    
    const status = await fineTuneService.getTaskStatus(taskId)
    
    // Автоматически подтверждаем когда модель готова
    if (status.progress === 'Delivered' && !status.acknowledged) {
      const ackResult = await fineTuneService.acknowledgeModel(taskId)
      status.acknowledged = ackResult.success
    }
    
    return NextResponse.json(status)
    
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json({ 
      error: error.message,
      taskId,
      progress: 'Error'
    }, { status: 500 })
  }
}