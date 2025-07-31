// hooks/useFineTuning.ts
/**
 * React hook for Fine-tuning operations
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { walletClientToSigner } from '@/lib/utils/wagmi-utils'
import { FineTuningService } from '@/lib/fine-tuning/service-simple'
import type { 
  FineTuningTask, 
  FineTuningAccount
} from '@/lib/fine-tuning/service-simple'
import type { TrainingParams, DatasetValidation } from '@/lib/fine-tuning/models'
import { toast } from '@/hooks/use-toast'

interface UseFineTuningState {
  account: FineTuningAccount | null
  tasks: FineTuningTask[]
  currentTask: FineTuningTask | null
  providers: any[]
  loading: boolean
  error: string | null
}

interface UseFineTuningActions {
  // Account management
  initializeAccount: (initialDeposit?: number) => Promise<void>
  refreshAccount: () => Promise<void>
  deposit: (amount: number) => Promise<void>
  
  // Dataset operations
  uploadDataset: (file: File) => Promise<{ rootHash: string; size: number } | null>
  validateDataset: (file: File) => Promise<DatasetValidation | null>
  
  // Task management
  createTask: (params: {
    agentId: string
    modelId: string
    datasetHash: string
    datasetSize: number
    trainingParams?: Partial<TrainingParams>
    providerAddress?: string
  }) => Promise<string | null>
  
  getTask: (taskId: string, providerAddress?: string) => Promise<FineTuningTask | null>
  getTaskLogs: (taskId: string, providerAddress?: string) => Promise<string[] | null>
  acknowledgeModel: (taskId: string, providerAddress?: string) => Promise<string | null>
  cancelTask: (taskId: string, providerAddress?: string) => Promise<void>
  
  // Provider operations
  listProviders: () => Promise<void>
  acknowledgeProvider: (providerAddress: string) => Promise<void>
  
  // Utilities
  clearError: () => void
  setCurrentTask: (task: FineTuningTask | null) => void
}

export function useFineTuning(): UseFineTuningState & UseFineTuningActions {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const serviceRef = useRef<FineTuningService | null>(null)
  const initPromiseRef = useRef<Promise<void> | null>(null)
  
  const [state, setState] = useState<UseFineTuningState>({
    account: null,
    tasks: [],
    currentTask: null,
    providers: [],
    loading: false,
    error: null
  })

  // Initialize service when wallet is connected
  const initializeService = useCallback(async () => {
    if (!isConnected || !walletClient || !address) {
      serviceRef.current = null
      return
    }

    if (serviceRef.current) return

    // Prevent multiple initializations
    if (initPromiseRef.current) {
      return initPromiseRef.current
    }

    initPromiseRef.current = (async () => {
      try {
        console.log('Initializing Fine-tuning service with real 0G SDK...')
        
        // Create service instance - no need for signer since it uses global broker
        serviceRef.current = new FineTuningService()
        await serviceRef.current.initialize()
        
        console.log('Fine-tuning service initialized successfully')
      } catch (error) {
        console.error('Failed to initialize Fine-tuning service:', error)
        throw error
      } finally {
        initPromiseRef.current = null
      }
    })()

    return initPromiseRef.current
  }, [isConnected, walletClient, address])

  // Get service instance
  const getService = useCallback(async (): Promise<FineTuningService> => {
    await initializeService()
    
    if (!serviceRef.current) {
      throw new Error('Fine-tuning service not initialized')
    }
    
    return serviceRef.current
  }, [initializeService])

  // Helper to handle async operations
  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    errorMessage: string = 'Operation failed'
  ): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const result = await operation()
      return result
    } catch (error: any) {
      const message = error?.message || errorMessage
      setState(prev => ({ ...prev, error: message }))
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      })
      return null
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [])

  // Account management
  const initializeAccount = useCallback(async (initialDeposit: number = 0.01) => {
    await withLoading(async () => {
      const service = await getService()
      await service.createAccount(initialDeposit)
      await refreshAccount()
      
      toast({
        title: 'Account Created',
        description: `Fine-tuning account created with ${initialDeposit} OG deposit`
      })
    }, 'Failed to create Fine-tuning account')
  }, [getService, withLoading])

  const refreshAccount = useCallback(async () => {
    await withLoading(async () => {
      const service = await getService()
      const account = await service.getAccount()
      setState(prev => ({ ...prev, account }))
      return account
    }, 'Failed to refresh account information')
  }, [getService, withLoading])

  const deposit = useCallback(async (amount: number) => {
    await withLoading(async () => {
      const service = await getService()
      await service.deposit(amount)
      await refreshAccount()
      
      toast({
        title: 'Deposit Successful',
        description: `Deposited ${amount} OG to Fine-tuning account`
      })
    }, 'Failed to deposit funds')
  }, [getService, withLoading, refreshAccount])

  // Dataset operations
  const uploadDataset = useCallback(async (file: File) => {
    return await withLoading(async () => {
      const service = await getService()
      const result = await service.uploadDataset(file)
      
      toast({
        title: 'Dataset Uploaded',
        description: `Dataset uploaded successfully. Root hash: ${result.rootHash.slice(0, 10)}...`
      })
      
      return result
    }, 'Failed to upload dataset')
  }, [getService, withLoading])

  const validateDataset = useCallback(async (file: File) => {
    return await withLoading(async () => {
      const service = await getService()
      return await service.validateDataset(file)
    }, 'Failed to validate dataset')
  }, [getService, withLoading])

  // Task management
  const createTask = useCallback(async (params: {
    agentId: string
    modelId: string
    datasetHash: string
    datasetSize: number
    trainingParams?: Partial<TrainingParams>
    providerAddress?: string
  }) => {
    return await withLoading(async () => {
      const service = await getService()
      const taskId = await service.createTask(params)
      
      // Refresh account to show locked funds
      await refreshAccount()
      
      toast({
        title: 'Task Created',
        description: `Fine-tuning task created. Task ID: ${taskId}`
      })
      
      return taskId
    }, 'Failed to create Fine-tuning task')
  }, [getService, withLoading, refreshAccount])

  const getTask = useCallback(async (taskId: string, providerAddress?: string) => {
    return await withLoading(async () => {
      const service = await getService()
      return await service.getTask(taskId, providerAddress)
    }, 'Failed to get task information')
  }, [getService, withLoading])

  const getTaskLogs = useCallback(async (taskId: string, providerAddress?: string) => {
    return await withLoading(async () => {
      const service = await getService()
      return await service.getTaskLogs(taskId, providerAddress)
    }, 'Failed to get task logs')
  }, [getService, withLoading])

  const acknowledgeModel = useCallback(async (taskId: string, providerAddress?: string) => {
    return await withLoading(async () => {
      const service = await getService()
      const path = await service.acknowledgeModel(taskId, providerAddress)
      
      toast({
        title: 'Model Acknowledged',
        description: 'Model delivery has been acknowledged'
      })
      
      return path
    }, 'Failed to acknowledge model')
  }, [getService, withLoading])

  const cancelTask = useCallback(async (taskId: string, providerAddress?: string) => {
    await withLoading(async () => {
      const service = await getService()
      await service.cancelTask(taskId, providerAddress)
      
      toast({
        title: 'Task Cancelled',
        description: 'Fine-tuning task has been cancelled'
      })
    }, 'Failed to cancel task')
  }, [getService, withLoading])

  // Provider operations
  const listProviders = useCallback(async () => {
    await withLoading(async () => {
      const service = await getService()
      const providers = await service.listProviders()
      setState(prev => ({ ...prev, providers }))
      return providers
    }, 'Failed to list providers')
  }, [getService, withLoading])

  const acknowledgeProvider = useCallback(async (providerAddress: string) => {
    await withLoading(async () => {
      const service = await getService()
      await service.acknowledgeProvider(providerAddress)
      
      toast({
        title: 'Provider Acknowledged',
        description: 'Provider has been acknowledged and is ready to use'
      })
    }, 'Failed to acknowledge provider')
  }, [getService, withLoading])

  // Utilities
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const setCurrentTask = useCallback((task: FineTuningTask | null) => {
    setState(prev => ({ ...prev, currentTask: task }))
  }, [])

  // Auto-refresh account when wallet connects
  useEffect(() => {
    if (isConnected && walletClient) {
      refreshAccount()
      listProviders()
    }
  }, [isConnected, walletClient, refreshAccount, listProviders])

  return {
    // State
    ...state,
    
    // Actions
    initializeAccount,
    refreshAccount,
    deposit,
    uploadDataset,
    validateDataset,
    createTask,
    getTask,
    getTaskLogs,
    acknowledgeModel,
    cancelTask,
    listProviders,
    acknowledgeProvider,
    clearError,
    setCurrentTask
  }
}