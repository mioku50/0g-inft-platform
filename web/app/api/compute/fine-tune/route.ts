import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBroker } from '@/lib/compute/broker'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const providerAddress = searchParams.get('provider')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const broker = await getBroker()
    if (!broker) {
      return NextResponse.json({ error: 'Failed to initialize broker' }, { status: 500 })
    }

    // Get task status from provider API
    const userAddress = broker.signerAddress
    const provider = providerAddress || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
    const providerUrl = 'http://50.145.48.68:30080' // Official 0G provider endpoint
    const taskUrl = `${providerUrl}/v1/user/${userAddress}/task/${taskId}`

    const response = await fetch(taskUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }
      return NextResponse.json({ error: `Failed to fetch task: ${response.statusText}` }, { status: response.status })
    }

    const taskData = await response.json()

    return NextResponse.json({
      success: true,
      task: {
        id: taskData.id || taskId,
        status: taskData.progress || 'Unknown',
        progress: taskData.progress || 'Unknown',
        createdAt: taskData.createdAt || new Date().toISOString(),
        fee: taskData.fee?.toString() || '0',
        modelRootHash: taskData.modelRootHash,
        error: taskData.error,
        provider
      }
    })
  } catch (error: any) {
    console.error('Failed to get fine-tuning task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get task' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      agentId,
      modelId,
      datasetHash,
      datasetSize,
      trainingParams,
      providerAddress
    } = body

    if (!agentId || !modelId || !datasetHash || !datasetSize) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const broker = await getBroker()
    if (!broker) {
      return NextResponse.json({ error: 'Failed to initialize broker' }, { status: 500 })
    }

    // Create config for training parameters
    const config = {
      num_train_epochs: 3,
      per_device_train_batch_size: 16,
      per_device_eval_batch_size: 16,
      warmup_steps: 500,
      weight_decay: 0.01,
      logging_dir: "./logs",
      logging_steps: 100,
      evaluation_strategy: "no",
      save_strategy: "epoch",
      save_steps: 1,
      save_total_limit: 1,
      eval_steps: 50,
      load_best_model_at_end: false,
      metric_for_best_model: "accuracy",
      greater_is_better: true,
      report_to: ["none"],
      ...trainingParams
    }

    const provider = providerAddress || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

    // Use the real broker's fine-tuning task creation
    const taskId = await broker.fineTuning.createTask(
      provider,
      modelId,
      datasetSize,
      datasetHash,
      JSON.stringify(config)
    )

    return NextResponse.json({
      success: true,
      taskId,
      message: 'Fine-tuning task created successfully'
    })
  } catch (error: any) {
    console.error('Failed to create fine-tuning task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}