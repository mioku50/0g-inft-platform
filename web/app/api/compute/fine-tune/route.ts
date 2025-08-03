import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getBroker } from '@/lib/compute/broker.server'
import { validateComputeEnvironment, shouldAttestOnChain } from '@/lib/server/compute-env'
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
    console.log('📥 Received fine-tune request:', { 
      agentId: body.agentId, 
      userAddress: body.userAddress, 
      modelId: body.modelId,
      datasetSize: body.datasetSize,
      providerAddress: body.providerAddress 
    })

    const {
      agentId,
      userAddress,
      modelId,
      datasetHash,
      datasetSize,
      trainingParams,
      providerAddress
    } = body

    // Enhanced validation with detailed error messages
    const validationErrors = []
    if (!agentId) validationErrors.push('agentId is required')
    if (!userAddress) validationErrors.push('userAddress is required')
    if (!ethers.isAddress(userAddress)) validationErrors.push('userAddress must be a valid Ethereum address')
    if (!modelId) validationErrors.push('modelId is required')
    if (!datasetHash) validationErrors.push('datasetHash is required')
    if (!datasetSize || isNaN(parseInt(datasetSize))) validationErrors.push('datasetSize must be a valid number')

    if (validationErrors.length > 0) {
      console.error('❌ Validation failed:', validationErrors)
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // Normalize and validate datasetHash format
    let normalizedDatasetHash = datasetHash
    if (datasetHash.startsWith('local://')) {
      // Extract hash from local:// format and add 0x prefix
      const extractedHash = datasetHash.replace('local://', '')
      if (extractedHash.match(/^[a-fA-F0-9]{64}$/)) {
        normalizedDatasetHash = `0x${extractedHash}`
        console.log('🔄 Normalized local hash:', datasetHash, '→', normalizedDatasetHash)
      } else {
        console.error('❌ Invalid hash in local:// format:', datasetHash)
        return NextResponse.json(
          { error: 'Invalid datasetHash format: local:// must contain valid 64-char hex hash' },
          { status: 400 }
        )
      }
    } else if (datasetHash.startsWith('0x')) {
      // Already properly formatted
      if (!datasetHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        console.error('❌ Invalid 0x datasetHash format:', datasetHash)
        return NextResponse.json(
          { error: 'datasetHash must be 0x followed by 64 hex characters' },
          { status: 400 }
        )
      }
    } else if (datasetHash.match(/^[a-fA-F0-9]{64}$/)) {
      // Add 0x prefix to bare hex
      normalizedDatasetHash = `0x${datasetHash}`
      console.log('🔄 Added 0x prefix:', datasetHash, '→', normalizedDatasetHash)
    } else {
      console.error('❌ Invalid datasetHash format:', datasetHash)
      return NextResponse.json(
        { error: 'datasetHash must be in format: 0x + 64 hex chars, local://hash, or 64 hex chars' },
        { status: 400 }
      )
    }

    // Initialize broker with detailed error logging
    console.log('🔧 Initializing 0G broker...')
    const broker = await getBroker()
    if (!broker) {
      console.error('❌ Failed to initialize 0G broker')
      return NextResponse.json({ 
        error: 'Failed to initialize 0G broker',
        details: 'Check OG_COMPUTE_PRIVATE_KEY and network configuration'
      }, { status: 500 })
    }
    console.log('✅ 0G broker initialized successfully')

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

    // Unified provider address management - config as source of truth
    const configProvider = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
    let finalProvider = configProvider
    
    // If user provided a different provider, validate it against allowed list
    if (providerAddress && providerAddress !== configProvider) {
      const allowedProviders = [
        '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f',
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
        '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
      ]
      
      if (allowedProviders.includes(providerAddress)) {
        finalProvider = providerAddress
        console.log(`📋 Using user-selected provider: ${providerAddress}`)
      } else {
        console.warn(`⚠️  Invalid provider ${providerAddress}, using config default: ${configProvider}`)
        finalProvider = configProvider
      }
    }
    
    console.log(`🎯 Final provider selection: ${finalProvider}`)
    console.log(`🌐 Provider endpoint: ${getProviderUrl(finalProvider)}`)
    console.log(`📊 Dataset hash: ${normalizedDatasetHash}`)
    
    const provider = finalProvider
    
    // Calculate hashes for on-chain attestation
    console.log('🧮 Calculating hashes for attestation...')
    const trainingParamsHash = calculateTrainingParamsHash(config)
    const pretrainedHash = getModelHash(modelId)
    
    console.log(`🚀 Creating fine-tuning task for agent ${agentId}...`)
    console.log(`📊 Parameters:`, {
      provider,
      modelId,
      datasetSize: parseInt(datasetSize),
      datasetHash: normalizedDatasetHash.slice(0, 10) + '...',
      configKeys: Object.keys(config)
    })

    // Step 0: Preflight check - verify provider is available
    try {
      console.log('🔍 Running provider preflight check...')
      const providerUrl = getProviderUrl(provider)
      
      // First try primary endpoint: GET /v1/quote (as per 0G spec)
      let preflightPassed = false
      let preflightMethod = ''
      
      try {
        const quoteUrl = `${providerUrl}/v1/quote`
        const quoteResponse = await fetch(quoteUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })
        
        if (quoteResponse.ok) {
          console.log('✅ Provider preflight check passed via /v1/quote')
          preflightPassed = true
          preflightMethod = '/v1/quote'
        } else if (quoteResponse.status === 404) {
          console.log('ℹ️  /v1/quote not found, trying fallback endpoints...')
        } else {
          console.warn(`⚠️  /v1/quote returned ${quoteResponse.status}`)
        }
      } catch (quoteError: any) {
        console.log('ℹ️  /v1/quote failed, trying fallback endpoints...', quoteError.message)
      }
      
      // If primary endpoint failed, try fallback endpoints
      if (!preflightPassed) {
        const fallbackEndpoints = ['/health', '/status']
        
        for (const endpoint of fallbackEndpoints) {
          try {
            const fallbackUrl = `${providerUrl}${endpoint}`
            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(5000)
            })
            
            if (fallbackResponse.ok) {
              console.log(`✅ Provider preflight check passed via ${endpoint}`)
              preflightPassed = true
              preflightMethod = endpoint
              break
            }
          } catch (fallbackError: any) {
            console.log(`ℹ️  ${endpoint} failed:`, fallbackError.message)
          }
        }
      }
      
      // If all endpoints failed with network errors, mark as unavailable
      if (!preflightPassed) {
        // Try one final basic connectivity test
        try {
          const basicResponse = await fetch(providerUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
          })
          
          // If we get any HTTP response (even 404), the server is reachable
          console.log(`ℹ️  Provider reachable but health endpoints not supported, continuing with task creation`)
          console.log(`📊 Provider responded with HTTP ${basicResponse.status}`)
        } catch (networkError: any) {
          // True network error - provider is actually unavailable
          console.warn('⚠️  Provider network unreachable:', networkError.message)
          return NextResponse.json({
            error: 'Provider unavailable (timeout/network error)',
            details: `Provider not responding: ${networkError.message}`,
            provider,
            step: 'network connectivity check'
          }, { status: 503 })
        }
      }
      
      console.log(`✅ Provider preflight completed successfully${preflightMethod ? ` via ${preflightMethod}` : ' (basic connectivity)'}`)
    } catch (preflightError: any) {
      console.warn('⚠️  Provider preflight check failed:', preflightError.message)
      return NextResponse.json({
        error: 'Provider unavailable (timeout/5xx)',
        details: `Provider not responding: ${preflightError.message}`,
        provider,
        step: 'preflight health check'
      }, { status: 503 })
    }

    // Step 1: Create task using direct provider API call
    let taskId: string
    try {
      // Get provider URL from mapping
      const providerUrls: Record<string, string> = {
        '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f': 'http://50.145.48.68:30080',
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd': 'http://50.145.48.68:30080', 
        '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3': 'http://50.145.48.68:30080'
      }
      const providerUrl = providerUrls[provider] || 'http://50.145.48.68:30080'
      
      // Try to get authentication headers using broker - handle ServiceNotExist gracefully
      let authHeaders: Record<string, string> = {}
      try {
        console.log(`🔐 Attempting to get request headers for provider ${provider}...`)
        authHeaders = await broker.inference.getRequestHeaders(provider, JSON.stringify(config))
        console.log(`✅ Authentication headers obtained successfully`)
      } catch (headerError: any) {
        if (headerError.message?.includes('ServiceNotExist') || 
            headerError.message?.includes('Service not found') ||
            headerError.message?.includes('Provider not registered')) {
          console.log(`ℹ️  Provider ${provider} not registered in registry, proceeding without authentication headers`)
          console.log(`📋 ServiceNotExist error bypassed as specified - creating task directly via HTTP API`)
          // Continue without auth headers - this is expected for unregistered providers
        } else {
          console.warn(`⚠️  Failed to get authentication headers: ${headerError.message}`)
          console.warn(`⚠️  Continuing without authentication headers`)
          // For any other header errors, log warning but continue
        }
      }
      
      // Create task via direct HTTP call to provider API (per 0G specification)
      const createTaskUrl = `${providerUrl}/v1/user/${userAddress}/task`
      
      const taskPayload = {
        userAddress,
        datasetHash: normalizedDatasetHash,
        preTrainedModelHash: pretrainedHash,
        trainingParams: JSON.stringify(config),
        fee: "0", // MVP: no fee for testing
        nonce: Date.now().toString(),
        signature: "0x" // MVP: dummy signature
      }
      
      console.log(`🚀 Creating task via provider API: ${createTaskUrl}`)
      console.log(`📦 Payload:`, { 
        userAddress, 
        datasetHashPreview: normalizedDatasetHash.slice(0, 10) + '...', 
        preTrainedModelHash: pretrainedHash,
        modelId,
        provider,
        endpoint: createTaskUrl
      })
      console.log(`🎯 Model details: modelId=${modelId}, preTrainedModelHash=${pretrainedHash}`)
      
      const response = await fetch(createTaskUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify(taskPayload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Provider API error: ${response.status} ${response.statusText}`)
        console.error(`❌ Error details: ${errorText}`)
        console.error(`❌ Provider: ${provider}, Endpoint: ${createTaskUrl}`)
        console.error(`❌ DatasetHash: ${normalizedDatasetHash}, ModelId: ${modelId}, PreTrainedModelHash: ${pretrainedHash}`)
        
        // Enhanced error handling per requirements
        if (response.status === 422) {
          // Validation errors - pass through provider's error message
          console.error(`❌ Provider validation error (422): ${errorText}`)
          if (errorText.includes('preTrainedModelHash') || errorText.includes('modelId')) {
            throw new Error(`Provider rejected task: invalid preTrainedModelHash (modelId=${modelId})`)
          }
          throw new Error(`Provider rejected task: ${errorText}`)
        }
        
        if (response.status >= 500) {
          // Server errors - return 503 Provider unavailable
          console.error(`❌ Provider server error (${response.status}): ${errorText}`)
          throw new Error(`Provider unavailable: HTTP ${response.status}`)
        }
        
        if (response.status === 400 && errorText.includes('preTrainedModelHash')) {
          throw new Error(`Provider rejected task: invalid preTrainedModelHash for model ${modelId}`)
        }
        
        if (response.status === 400 && errorText.includes('model')) {
          throw new Error(`Unsupported model ${modelId} for this provider`)
        }
        
        // Other 4xx errors
        throw new Error(`Provider API error: ${response.status} ${response.statusText}: ${errorText}`)
      }
      
      // Handle response according to 0G specification
      if (response.status === 204) {
        // 204 No Content is the expected success response per 0G specification
        // No JSON body expected, generate a task ID based on the request
        taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        console.log(`✅ Task created successfully (204 No Content): ${taskId}`)
        console.log(`✅ Provider response: 204 No Content as per 0G specification`)
      } else {
        // If provider returns JSON (non-standard but handle gracefully)
        try {
          const result = await response.json()
          taskId = result.taskId || result.id || `task_${Date.now()}`
          console.log(`✅ Task created with ID: ${taskId}`)
          console.log(`✅ Raw provider response:`, result)
        } catch (jsonError) {
          // If JSON parsing fails, generate task ID
          taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          console.log(`✅ Task created (non-JSON response): ${taskId}`)
        }
      }
    } catch (createError: any) {
      console.error('❌ Failed to create task with 0G provider:', createError)
      console.error(`❌ Provider: ${provider}, ModelId: ${modelId}, PreTrainedModelHash: ${pretrainedHash}`)
      console.error(`❌ DatasetHash: ${normalizedDatasetHash}, HTTP Status: ${createError.message}`)
      
      // Enhanced error handling with proper status codes per requirements
      if (createError.message?.includes('Provider unavailable: HTTP 5') ||
          createError.message?.includes('Provider unavailable') || 
          createError.message?.includes('Provider not responding') ||
          createError.message?.includes('ECONNREFUSED') ||
          createError.message?.includes('fetch failed') ||
          createError.message?.includes('timeout')) {
        return NextResponse.json({
          error: 'Provider unavailable',
          details: createError.message,
          provider,
          endpoint: getProviderUrl(provider),
          step: 'Provider API call'
        }, { status: 503 })
      }
      
      if (createError.message?.includes('invalid preTrainedModelHash') ||
          createError.message?.includes('Provider rejected task')) {
        return NextResponse.json({
          error: createError.message,
          details: `Model validation failed. Model: ${modelId}, Hash: ${pretrainedHash}`,
          provider,
          modelId,
          preTrainedModelHash: pretrainedHash,
          step: 'Model validation'
        }, { status: 422 })
      }
      
      if (createError.message?.includes('Unsupported model')) {
        return NextResponse.json({
          error: `Unsupported model for this provider`,
          details: `Model ${modelId} is not supported by provider ${provider}`,
          provider,
          modelId,
          step: 'Model compatibility check'
        }, { status: 422 })
      }
      
      if (createError.message?.includes('400') || 
          createError.message?.includes('Invalid') || 
          createError.message?.includes('validation')) {
        return NextResponse.json({
          error: 'Invalid request parameters',
          details: createError.message,
          provider,
          modelId,
          preTrainedModelHash: pretrainedHash,
          step: 'Parameter validation'
        }, { status: 422 })
      }
      
      return NextResponse.json({
        error: 'Failed to create task with 0G provider',
        details: createError.message,
        provider,
        modelId,
        preTrainedModelHash: pretrainedHash,
        datasetHash: normalizedDatasetHash,
        step: 'Provider API call',
        context: 'Task creation failed during provider communication'
      }, { status: 500 })
    }

    // Step 2: Check provider registration and attest task creation on-chain if appropriate
    let txHashAttested: string | undefined
    let attestationStatus: 'success' | 'skipped' | 'failed' = 'skipped'
    let attestationMessage: string = ''
    
    // Check if on-chain attestation is enabled
    const shouldAttest = shouldAttestOnChain()
    console.log(`🔧 On-chain attestation enabled: ${shouldAttest}`)
    
    let providerRegistered = false
    
    if (shouldAttest) {
      // Check if provider is registered before attempting attestation
      providerRegistered = await isProviderRegistered(broker, provider)
      
      if (providerRegistered) {
        try {
          console.log('⛓️  Attesting task creation on-chain...')
          txHashAttested = await AgentModelRegistryService.attestTask(
            parseInt(agentId),
            userAddress,
            provider,
            normalizedDatasetHash,
            pretrainedHash,
            trainingParamsHash,
            taskId
          )
          console.log(`✅ Task attested on-chain: ${txHashAttested}`)
          attestationStatus = 'success'
          attestationMessage = 'Task successfully attested on-chain'
        } catch (attestError: any) {
          console.error('❌ Failed to attest task on-chain:', attestError)
          attestationStatus = 'failed'
          attestationMessage = `On-chain attestation failed: ${attestError.message}`
          
          // Enhanced error handling for attestation failures
          if (attestError.message?.includes('insufficient funds')) {
            return NextResponse.json({
              error: 'Platform account insufficient funds',
              details: 'Platform needs more ETH for gas fees',
              taskId,
              step: 'On-chain attestation',
              context: 'Platform gas account needs funding'
            }, { status: 500 })
          }
          
          return NextResponse.json({
            error: 'Failed to attest task on blockchain',
            details: attestError.message,
            taskId,
            step: 'On-chain attestation',
            context: 'Blockchain transaction failed'
          }, { status: 500 })
        }
      } else {
        console.log('ℹ️  Provider not registered in 0G registry, skipping on-chain attestation')
        attestationStatus = 'skipped'
        attestationMessage = 'On-chain attestation skipped (provider not registered in 0G registry)'
      }
    } else {
      console.log('ℹ️  On-chain attestation disabled by configuration (FT_ATTEST_ONCHAIN=0)')
      attestationStatus = 'skipped'
      attestationMessage = 'On-chain attestation disabled by configuration'
    }

    // Step 3: Save task to database
    try {
      console.log('💾 Saving task to database...')
      await db.createTrainingTask({
        taskId,
        agentId: parseInt(agentId),
        userAddress,
        providerAddress: provider,
        modelId,
        datasetRootHash: normalizedDatasetHash,
        trainingParamsHash,
        status: 'Init',
        txHashAttested,
        attestationStatus
      })
      console.log(`✅ Task saved to database`)
    } catch (dbError: any) {
      console.error('❌ Failed to save task to database:', dbError)
      // Don't fail the entire request for database issues
      console.warn('⚠️  Continuing despite database save failure')
    }

    const result = {
      success: true,
      message: 'Task created successfully',
      taskId,
      provider,
      providerUrl: getProviderUrl(provider),
      datasetHash: normalizedDatasetHash,
      modelId,
      attestation: {
        status: attestationStatus,
        message: attestationMessage,
        txHash: txHashAttested,
        chainLink: txHashAttested ? AgentModelRegistryService.getChainLink(txHashAttested) : undefined,
        enabled: shouldAttestOnChain()
      },
      monitoring: {
        statusUrl: `${getProviderUrl(provider)}/v1/user/${userAddress}/task/${taskId}`,
        logsUrl: `${getProviderUrl(provider)}/v1/user/${userAddress}/task/${taskId}/log`
      }
    }

    // Comprehensive logging as required
    console.log('📊 FINE-TUNING TASK CREATION COMPLETE')
    console.log(`📋 Provider: ${provider} (${providerRegistered ? 'registered' : 'unregistered'})`)
    console.log(`🌐 Endpoint: ${getProviderUrl(provider)}/v1/user/${userAddress}/task`)
    console.log(`📊 DatasetHash: ${normalizedDatasetHash}`)
    console.log(`🤖 ModelId: ${modelId}`)
    console.log(`🎯 PreTrainedModelHash: ${pretrainedHash}`)
    console.log(`✅ HTTP Status: 200 (Task created successfully)`)
    console.log(`🎉 TaskId: ${taskId}`)
    console.log(`⛓️  Attestation Status: ${attestationStatus}`)
    console.log(`📝 Attestation Message: ${attestationMessage}`)
    if (txHashAttested) {
      console.log(`🔗 Chain Link: ${AgentModelRegistryService.getChainLink(txHashAttested)}`)
    }
    console.log(`📊 Monitor Status: ${result.monitoring.statusUrl}`)
    console.log(`📋 Monitor Logs: ${result.monitoring.logsUrl}`)

    console.log('🎉 Fine-tuning task created successfully:', result)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('💥 Unexpected error in fine-tune API:', error)
    console.error('Stack trace:', error.stack)
    
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
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

async function isProviderRegistered(broker: any, providerAddress: string): Promise<boolean> {
  try {
    console.log(`🔍 Checking if provider ${providerAddress} is registered...`)
    
    // Use broker.inference.getService to check if provider is registered
    const service = await broker.inference.contract.getService(providerAddress)
    
    // If service exists and has a valid URL, provider is registered
    const isRegistered = service && service.url && service.url.length > 0
    
    console.log(`📋 Provider ${providerAddress} registration status: ${isRegistered ? 'registered' : 'not registered'}`)
    return isRegistered
    
  } catch (error: any) {
    console.log(`ℹ️  Provider ${providerAddress} registration check failed: ${error.message}`)
    
    // If getService throws ServiceNotExist or similar, provider is not registered
    if (error.message?.includes('ServiceNotExist') || 
        error.message?.includes('Service not found') ||
        error.message?.includes('execution reverted')) {
      console.log(`📋 Provider ${providerAddress} confirmed as unregistered`)
      return false
    }
    
    // For any other errors, assume not registered to be safe
    console.log(`⚠️  Assuming provider ${providerAddress} is not registered due to error`)
    return false
  }
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