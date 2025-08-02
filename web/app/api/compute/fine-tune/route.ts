import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBroker } from '@/lib/compute/broker.server'
import { validateComputeEnvironment } from '@/lib/server/compute-env'
import AgentModelRegistryService, { calculateTrainingParamsHash } from '@/lib/contracts/agent-model-registry'
import { db, addDeliveredModel } from '@/database/connection'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const agentId = searchParams.get('agentId')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    // Get task from database first
    const dbTask = await db.getTrainingTaskById(taskId)
    
    if (dbTask) {
      // Check for updates from provider API
      const broker = await getBroker()
      if (broker) {
        try {
          const provider = dbTask.providerAddress
          const providerUrl = getProviderUrl(provider)
          const taskUrl = `${providerUrl}/v1/user/${dbTask.userAddress}/task/${taskId}`

          const response = await fetch(taskUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          })

          if (response.ok) {
            const taskData = await response.json()
            
            // Update database if status changed
            if (taskData.progress !== dbTask.status) {
              await db.updateTrainingTask(taskId, {
                status: taskData.progress,
                modelRootHash: taskData.modelRootHash,
                errorMessage: taskData.error
              })
              
              // If model was delivered, attest delivery on-chain
              if (taskData.progress === 'Delivered' && taskData.modelRootHash && !dbTask.modelRootHash) {
                await handleModelDelivery(dbTask, taskData.modelRootHash)
              }
            }
            
            // Return updated task info
            return NextResponse.json({
              success: true,
              task: {
                id: taskId,
                agentId: dbTask.agentId,
                status: taskData.progress || dbTask.status,
                progress: taskData.progress || dbTask.status,
                createdAt: dbTask.createdAt.toISOString(),
                updatedAt: dbTask.updatedAt.toISOString(),
                fee: taskData.fee?.toString() || '0',
                modelRootHash: taskData.modelRootHash || dbTask.modelRootHash,
                provider: dbTask.providerAddress,
                error: taskData.error || dbTask.errorMessage
              }
            })
          }
        } catch (error) {
          console.warn('Failed to fetch task from provider, using database:', error)
        }
      }
      
      // Return database info if provider API fails
      return NextResponse.json({
        success: true,
        task: {
          id: taskId,
          agentId: dbTask.agentId,
          status: dbTask.status,
          progress: dbTask.status,
          createdAt: dbTask.createdAt.toISOString(),
          updatedAt: dbTask.updatedAt.toISOString(),
          fee: '0',
          modelRootHash: dbTask.modelRootHash,
          provider: dbTask.providerAddress,
          error: dbTask.errorMessage
        }
      })
    }

    // Task not found in database, try provider API directly
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  } catch (error: any) {
    console.error('Failed to get fine-tuning task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get task' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    return NextResponse.json({
      error: 'Compute environment misconfigured',
      details: envValidation.errors
    }, { status: 503 })
  }

  try {
    const body = await request.json()
    const {
      agentId,
      userAddress,
      modelId,
      datasetHash,
      datasetSize,
      trainingParams,
      providerAddress
    } = body

    if (!agentId || !userAddress || !modelId || !datasetHash || !datasetSize) {
      return NextResponse.json(
        { error: 'Missing required parameters: agentId, userAddress, modelId, datasetHash, datasetSize' },
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
    
    // Calculate hashes for on-chain attestation
    const trainingParamsHash = calculateTrainingParamsHash(config)
    const pretrainedHash = getModelHash(modelId) // Get from models definition
    
    console.log(`🚀 Creating fine-tuning task for agent ${agentId}...`)

    // Step 1: Create task using 0G SDK (platform-funded)
    const taskId = await broker.fineTuning.createTask(
      provider,
      modelId,
      parseInt(datasetSize),
      datasetHash,
      JSON.stringify(config)
    )

    console.log(`✅ Task created with ID: ${taskId}`)

    // Step 2: Attest task creation on-chain (platform pays gas)
    const txHashAttested = await AgentModelRegistryService.attestTask(
      parseInt(agentId),
      userAddress,
      provider,
      datasetHash,
      pretrainedHash,
      trainingParamsHash,
      taskId
    )

    console.log(`✅ Task attested on-chain: ${txHashAttested}`)

    // Step 3: Save task to database
    await db.createTrainingTask({
      taskId,
      agentId: parseInt(agentId),
      userAddress,
      providerAddress: provider,
      modelId,
      datasetRootHash: datasetHash,
      trainingParamsHash,
      status: 'Init',
      txHashAttested
    })

    console.log(`✅ Task saved to database`)

    return NextResponse.json({
      success: true,
      taskId,
      txHashAttested,
      chainLink: AgentModelRegistryService.getChainLink(txHashAttested),
      message: 'Fine-tuning task created and attested successfully'
    })

  } catch (error: any) {
    console.error('Failed to create fine-tuning task:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    )
  }
}

// Utility functions
function getProviderUrl(providerAddress: string): string {
  // Map provider addresses to their URLs
  const providerUrls: Record<string, string> = {
    '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f': 'http://50.145.48.68:30080',
    '0xf07240Efa67755B5311bc75784a061eDB47165Dd': 'http://50.145.48.68:30080',
    '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3': 'http://50.145.48.68:30080'
  }
  
  return providerUrls[providerAddress] || 'http://50.145.48.68:30080'
}

function getModelHash(modelId: string): string {
  // Map model IDs to their hashes from the models definition
  const modelHashes: Record<string, string> = {
    'distilbert-base-uncased': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
    'llama-3.3-70b-instruct': '0x8f3244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110b8',
    'deepseek-r1-70b': '0x9f4244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110c9',
    'gpt-3.5-turbo-fine-tune': '0xaf5244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110da',
    'code-llama-13b-instruct': '0xbf6244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110eb',
    'mistral-7b-instruct': '0xcf7244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110fc'
  }
  
  return modelHashes[modelId] || ethers.keccak256(ethers.toUtf8Bytes(modelId))
}

async function handleModelDelivery(dbTask: any, modelRootHash: string) {
  try {
    console.log(`🎁 Handling model delivery for task ${dbTask.taskId}...`)
    
    // Attest delivery on-chain (platform pays gas)
    const txHashDelivered = await AgentModelRegistryService.attestDelivery(
      dbTask.agentId,
      dbTask.userAddress,
      dbTask.providerAddress,
      modelRootHash,
      ethers.keccak256(ethers.toUtf8Bytes('{}')), // Empty metrics for now
      ethers.keccak256(ethers.toUtf8Bytes('{}')), // Empty logs for now
      dbTask.taskId
    )

    console.log(`✅ Model delivery attested: ${txHashDelivered}`)

    // Add delivered model to database
    await addDeliveredModel(
      dbTask.agentId,
      modelRootHash,
      dbTask.datasetRootHash,
      getModelHash(dbTask.modelId),
      dbTask.trainingParamsHash,
      dbTask.providerAddress,
      dbTask.taskId,
      txHashDelivered
    )

    console.log(`✅ Model added to database as candidate`)

  } catch (error) {
    console.error('Failed to handle model delivery:', error)
  }
}