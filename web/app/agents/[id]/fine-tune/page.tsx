'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useDropzone } from 'react-dropzone'

// Feature flags
import { isFeatureEnabled } from '@/lib/utils/feature-flags'
import { ComingSoonPage } from '@/components/ComingSoonPage'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ToastAction } from '@/components/ui/toast'

// Icons
import { 
  ArrowLeft, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Wallet,
  ExternalLink,
  Brain,
  Zap,
  Play,
  Eye,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Monitor,
  Download
} from 'lucide-react'

// Hooks and utilities
import { useFineTuning } from '@/hooks/useFineTuning'
import { useAccountBootstrap } from '@/hooks/useAccountBootstrap'
import { AccountBootstrapModal } from '@/components/modals/AccountBootstrapModal'
import { toast } from '@/hooks/use-toast'
import { 
  FINE_TUNING_MODELS, 
  FINE_TUNING_PROVIDERS,
  getActiveModels,
  getAvailableProviders,
  DEFAULT_TRAINING_PARAMS,
  TASK_STATUS,
  type TaskStatus
} from '@/lib/fine-tuning/models'

export default function AgentFineTunePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const agentId = params.id
  const { address, isConnected } = useAccount()

  // Fine-tuning hook - must be called before any early returns
  const {
    account,
    currentTask,
    providers,
    loading,
    error,
    initializeAccount,
    refreshAccount,
    deposit,
    uploadDataset,
    validateDataset,
    createTask,
    getTask,
    getTaskLogs,
    acknowledgeModel,
    acknowledgeProvider,
    setCurrentTask,
    clearError,
    activateModel
  } = useFineTuning()

  // Account bootstrap hook for wallet onboarding (per requirements)
  const {
    account: bootstrapAccount,
    loading: bootstrapLoading,
    error: bootstrapError,
    showCreateModal,
    showTopUpModal,
    createAccount,
    depositFunds,
    setShowCreateModal,
    setShowTopUpModal,
    refreshAccount: refreshBootstrapAccount
  } = useAccountBootstrap()

  // Local state for workflow
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [datasetFile, setDatasetFile] = useState<File | null>(null)
  const [datasetInfo, setDatasetInfo] = useState<any>(null)
  const [uploadedDataset, setUploadedDataset] = useState<{ rootHash: string; size: number } | null>(null)
  const [trainingParams, setTrainingParams] = useState(DEFAULT_TRAINING_PARAMS)
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [taskPolling, setTaskPolling] = useState<NodeJS.Timeout | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Load cached dataset from localStorage
  useEffect(() => {
    const cacheKey = `fine-tune-dataset-${agentId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const data = JSON.parse(cached)
        // Only use cache if it's recent (within 24 hours)
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          setUploadedDataset({
            rootHash: data.rootHash,
            size: data.size
          })
        }
      } catch (error) {
        console.warn('Failed to load cached dataset:', error)
      }
    }
  }, [agentId])

  // Initialize defaults
  useEffect(() => {
    const activeModels = getActiveModels()
    const availableProviders = getAvailableProviders()
    
    if (activeModels.length > 0 && !selectedModel) {
      setSelectedModel(activeModels[0].id)
    }
    
    if (availableProviders.length > 0 && !selectedProvider) {
      setSelectedProvider(availableProviders[0].address)
    }
  }, [selectedModel, selectedProvider])

  // Dropzone for dataset upload
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'application/jsonl': ['.jsonl'],
      'text/plain': ['.txt']
    },
    maxSize: 10 * 1024 * 1024, // 10MB limit
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setDatasetFile(acceptedFiles[0])
        toast({
          title: 'File Selected',
          description: `Selected ${acceptedFiles[0].name} for upload`
        })
      }
    }
  })

  // Check if fine-tuning is disabled - after all hooks
  if (isFeatureEnabled('FT_DISABLED')) {
    return <ComingSoonPage agentId={agentId} />
  }

  // Steps configuration
  const steps = [
    { id: 1, label: 'Account', icon: Wallet, description: 'Setup Fine-tuning account' },
    { id: 2, label: 'Dataset', icon: Upload, description: 'Upload training data' },
    { id: 3, label: 'Model', icon: Brain, description: 'Select base model' },
    { id: 4, label: 'Parameters', icon: Settings, description: 'Configure training' },
    { id: 5, label: 'Training', icon: Play, description: 'Start fine-tuning' },
    { id: 6, label: 'Monitor', icon: Monitor, description: 'Track progress' }
  ]

  // Step validation logic
  const isStepComplete = (stepId: number): boolean => {
    switch (stepId) {
      case 1: return !!(account?.exists && parseFloat(account.balance) >= 0.01)
      case 2: return uploadedDataset !== null
      case 3: return selectedModel !== ''
      case 4: return true // Parameters always valid with defaults
      case 5: return currentTask !== null
      case 6: return currentTask?.status === 'Delivered' || currentTask?.status === 'Finished'
      default: return false
    }
  }

  const canProceedToStep = (stepId: number): boolean => {
    if (stepId === 1) return true
    return isStepComplete(stepId - 1)
  }

  // Navigation handlers
  const nextStep = () => {
    if (currentStep < 6 && canProceedToStep(currentStep + 1)) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const goToStep = (stepId: number) => {
    if (canProceedToStep(stepId)) {
      setCurrentStep(stepId)
    }
  }

  // Action handlers
  const handleDatasetUpload = async () => {
    if (!datasetFile) return
    
    try {
      const validation = await validateDataset(datasetFile)
      if (validation?.isValid) {
        const result = await uploadDataset(datasetFile)
        if (result) {
          setUploadedDataset(result)
          setDatasetInfo(validation)
          
          // Cache dataset info in localStorage for current agent
          const cacheKey = `fine-tune-dataset-${agentId}`
          localStorage.setItem(cacheKey, JSON.stringify({
            rootHash: result.rootHash,
            size: result.size,
            fileName: datasetFile.name,
            timestamp: Date.now()
          }))
          
          nextStep()
        }
      }
    } catch (error) {
      console.error('Dataset upload error:', error)
    }
  }

  const handleStartTraining = async () => {
    if (!uploadedDataset || !selectedModel) return

    try {
      const result = await createTask({
        agentId,
        userAddress: address!,
        modelId: selectedModel,
        datasetHash: uploadedDataset.rootHash,
        datasetSize: uploadedDataset.size,
        trainingParams,
        providerAddress: selectedProvider
      })

      if (result && result.taskId) {
        // Store result for monitoring 
        setCurrentTask({
          id: result.taskId,
          agentId,
          modelId: selectedModel,
          datasetHash: uploadedDataset.rootHash,
          status: 'Init',
          progress: 'Starting...',
          createdAt: new Date().toISOString(),
          provider: result.provider,
          fee: '0'
        })
        
        // Start polling for status
        const polling = setInterval(async () => {
          const task = await getTask(result.taskId, result.provider)
          if (task) {
            setCurrentTask(task)
            if (task.status === 'Delivered' || task.status === 'Finished' || task.status === 'Failed') {
              if (taskPolling) clearInterval(taskPolling)
              setTaskPolling(null)
            }
          }
        }, 15000)
        
        setTaskPolling(polling)
        nextStep()
      }
    } catch (error) {
      console.error('Training start error:', error)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Connect Your Wallet</h2>
            <p className="text-purple-200 text-center mb-6">
              Please connect your wallet to access Fine-tuning features
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/agents/${agentId}`}>
            <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agent
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Fine-tune Agent</h1>
            <p className="text-purple-200">Train your AI agent with custom data on 0G Compute Network</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" className="ml-2" onClick={clearError}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Step Navigation */}
          <div className="lg:col-span-1">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm text-white">Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {steps.map((step) => {
                  const Icon = step.icon
                  const isCompleted = isStepComplete(step.id)
                  const isCurrent = currentStep === step.id
                  const canAccess = canProceedToStep(step.id)
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                        isCurrent ? 'bg-gradient-to-r from-purple-600/50 to-blue-600/50 border border-purple-400/30' :
                        canAccess ? 'hover:bg-white/10' : 'opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => canAccess && goToStep(step.id)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg' :
                        isCurrent ? 'bg-gradient-to-br from-purple-400 to-blue-400 text-white shadow-lg' :
                        'border border-white/30 text-white/60'
                      }`}>
                        {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{step.label}</div>
                        <div className="text-xs text-purple-200">{step.description}</div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm min-h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  {steps.find(s => s.id === currentStep)?.icon && 
                    React.createElement(steps.find(s => s.id === currentStep)!.icon, { className: "h-5 w-5" })
                  }
                  Step {currentStep}: {steps.find(s => s.id === currentStep)?.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1: Account */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Account Setup</h3>
                      <p className="text-purple-200">Create and fund your Fine-tuning account</p>
                    </div>

                    <div className="max-w-md mx-auto space-y-4">
                      {/* Account Status */}
                      <div className="p-6 bg-white/10 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-4 h-4 rounded-full ${account?.exists ? 'bg-green-400 shadow-lg shadow-green-400/50' : 'bg-red-400 shadow-lg shadow-red-400/50'}`} />
                          <span className="text-white font-medium">
                            {account?.exists ? 'Account Active' : 'Account Required'}
                          </span>
                        </div>
                        
                        {account?.exists ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-xs text-purple-200">Balance</div>
                              <div className="font-semibold text-white">{account.balance} OG</div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-purple-200">Locked</div>
                              <div className="font-semibold text-orange-300">{account.locked} OG</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="text-sm text-orange-200">
                              You need to create a Fine-tuning account to continue
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3">
                        <Button 
                          variant="outline" 
                          onClick={refreshAccount}
                          disabled={loading}
                          className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
                          Refresh Account
                        </Button>

                        {(!account?.exists || parseFloat(account?.balance || '0') < 0.01) && (
                          <div className="space-y-3 pt-3 border-t border-white/10">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="0.01"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                                min="0.001"
                                step="0.001"
                              />
                              <span className="text-xs text-white/60">OG</span>
                            </div>
                            
                            <Button
                              onClick={() => {
                                const amount = parseFloat(depositAmount) || 0.01
                                if (!account?.exists) {
                                  initializeAccount(amount)
                                } else {
                                  deposit(amount)
                                }
                              }}
                              disabled={loading || !isConnected}
                              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
                            >
                              {loading ? (
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Wallet className="h-4 w-4 mr-2" />
                              )}
                              {!account?.exists ? 'Create Account' : 'Add Funds'}
                            </Button>
                            
                            <div className="text-xs text-purple-200 text-center">
                              Minimum: 0.01 OG required for fine-tuning
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Dataset */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Upload Training Dataset</h3>
                      <p className="text-purple-200">Provide training data for your AI model</p>
                    </div>

                    {!uploadedDataset ? (
                      <div className="max-w-2xl mx-auto space-y-4">
                        {/* File Upload */}
                        <div 
                          {...getRootProps()} 
                          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                            isDragActive ? 'border-purple-400 bg-purple-400/10' : 'border-white/30 hover:border-white/50'
                          }`}
                        >
                          <input {...getInputProps()} />
                          <Upload className="h-12 w-12 mx-auto mb-4 text-purple-300" />
                          <div className="text-white mb-2">
                            {isDragActive ? 'Drop your dataset here' : 'Drag & drop your dataset, or click to browse'}
                          </div>
                          <div className="text-sm text-purple-200 space-y-1">
                            <div>Supported: .jsonl (recommended), .json, .txt (max 100MB)</div>
                            <div className="text-xs">📄 .json and .txt files will be automatically converted to .jsonl format</div>
                          </div>
                        </div>

                        {datasetFile && (
                          <div className="p-4 bg-white/10 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-purple-300" />
                              <div className="flex-1">
                                <div className="text-white font-medium">{datasetFile.name}</div>
                                <div className="text-sm text-purple-200">
                                  {datasetFile.size >= 1024 * 1024 
                                    ? `${(datasetFile.size / 1024 / 1024).toFixed(2)} MB` 
                                    : datasetFile.size >= 1024 
                                      ? `${(datasetFile.size / 1024).toFixed(1)} KB`
                                      : `${datasetFile.size} bytes`
                                  } • {datasetFile.type || 'Unknown type'}
                                </div>
                              </div>
                              <Button
                                onClick={handleDatasetUpload}
                                disabled={loading}
                                className="bg-gradient-to-r from-purple-600 to-blue-600"
                              >
                                {loading ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                Upload
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-md mx-auto">
                        <div className="p-6 bg-green-900/20 border border-green-500/50 rounded-lg text-center">
                          <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-400" />
                          <h4 className="text-lg font-semibold text-white mb-2">Dataset Uploaded</h4>
                          <div className="text-sm text-green-200 space-y-1">
                            <div>Root Hash: {uploadedDataset.rootHash.slice(0, 20)}...</div>
                            <div>Size: {(uploadedDataset.size / 1024 / 1024).toFixed(2)} MB</div>
                            {datasetFile && (
                              <div>Original: {datasetFile.name}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Model Selection */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Select Base Model</h3>
                      <p className="text-purple-200">Choose the AI model you want to fine-tune</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {getActiveModels().map((model) => (
                        <div
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                          className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedModel === model.id 
                              ? 'border-purple-400 bg-purple-400/10 shadow-lg' 
                              : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Brain className="h-6 w-6 text-purple-300 mt-1 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-white mb-1">{model.name}</h4>
                              <p className="text-sm text-purple-200 mb-3">{model.description}</p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-purple-300">Parameters:</span>
                                  <span className="text-white">{model.parameters}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-purple-300">Training Time:</span>
                                  <span className="text-white">{model.trainingTime}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-purple-300">GPU Required:</span>
                                  <span className="text-white">{model.gpuRequirement}</span>
                                </div>
                              </div>
                            </div>
                            {selectedModel === model.id && (
                              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 4: Parameters */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Training Parameters</h3>
                      <p className="text-purple-200">Configure how your model will be trained</p>
                    </div>

                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-white">Training Epochs</Label>
                          <Input
                            type="number"
                            value={trainingParams.epochs}
                            onChange={(e) => setTrainingParams({...trainingParams, epochs: parseInt(e.target.value)})}
                            className="bg-white/5 border-white/20 text-white"
                            min="1"
                            max="10"
                          />
                          <div className="text-xs text-purple-200">Number of training iterations</div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white">Learning Rate</Label>
                          <Input
                            type="number"
                            value={trainingParams.learningRate}
                            onChange={(e) => setTrainingParams({...trainingParams, learningRate: parseFloat(e.target.value)})}
                            className="bg-white/5 border-white/20 text-white"
                            step="0.0001"
                            min="0.0001"
                            max="0.01"
                          />
                          <div className="text-xs text-purple-200">How fast the model learns</div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white">Batch Size</Label>
                          <Input
                            type="number"
                            value={trainingParams.batchSize}
                            onChange={(e) => setTrainingParams({...trainingParams, batchSize: parseInt(e.target.value)})}
                            className="bg-white/5 border-white/20 text-white"
                            min="1"
                            max="64"
                          />
                          <div className="text-xs text-purple-200">Training samples per batch</div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white">Training Steps</Label>
                          <Input
                            type="number"
                            value={trainingParams.steps}
                            onChange={(e) => setTrainingParams({...trainingParams, steps: parseInt(e.target.value)})}
                            className="bg-white/5 border-white/20 text-white"
                            min="100"
                            max="10000"
                          />
                          <div className="text-xs text-purple-200">Total training steps</div>
                        </div>
                      </div>

                      {/* Preset Buttons */}
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTrainingParams({...DEFAULT_TRAINING_PARAMS, epochs: 1, steps: 100})}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          Quick Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTrainingParams(DEFAULT_TRAINING_PARAMS)}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          Balanced
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTrainingParams({...DEFAULT_TRAINING_PARAMS, epochs: 5, steps: 2000})}
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          High Quality
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Start Training */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Start Fine-tuning</h3>
                      <p className="text-purple-200">Review settings and begin training</p>
                    </div>

                    <div className="max-w-2xl mx-auto space-y-6">
                      {/* Summary */}
                      <div className="p-6 bg-white/10 rounded-lg space-y-4">
                        <h4 className="font-semibold text-white">Training Summary</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-purple-200">Model:</span>
                            <div className="text-white font-medium">
                              {getActiveModels().find(m => m.id === selectedModel)?.name}
                            </div>
                          </div>
                          <div>
                            <span className="text-purple-200">Dataset:</span>
                            <div className="text-white font-medium">
                              {uploadedDataset ? `${uploadedDataset.size} bytes` : 'None'}
                            </div>
                          </div>
                          <div>
                            <span className="text-purple-200">Epochs:</span>
                            <div className="text-white font-medium">{trainingParams.epochs}</div>
                          </div>
                          <div>
                            <span className="text-purple-200">Learning Rate:</span>
                            <div className="text-white font-medium">{trainingParams.learningRate}</div>
                          </div>
                        </div>
                      </div>

                      {/* Start Button */}
                      <div className="text-center">
                        <Button
                          onClick={handleStartTraining}
                          disabled={loading || !uploadedDataset || !selectedModel}
                          className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white border-0 px-8 py-3"
                          size="lg"
                        >
                          {loading ? (
                            <Clock className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-5 w-5 mr-2" />
                          )}
                          Start Fine-tuning
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Monitor */}
                {currentStep === 6 && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-white mb-2">Training Progress</h3>
                      <p className="text-purple-200">Monitor your fine-tuning task and manage model versions</p>
                    </div>

                    {currentTask ? (
                      <div className="max-w-2xl mx-auto space-y-4">
                        {/* Status */}
                        <div className="p-4 bg-white/10 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">Status</span>
                            <Badge variant={currentTask.status === 'Failed' ? 'destructive' : 'default'}>
                              {currentTask.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-purple-200">
                            Task ID: {currentTask.id}
                          </div>
                          {currentTask.status === 'Init' && (
                            <div className="text-xs text-blue-300 mt-1">
                              ✅ Task created and attested on-chain
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {currentTask.status === 'Training' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-purple-200">Training Progress</span>
                              <span className="text-white">~50%</span>
                            </div>
                            <Progress value={50} className="h-2" />
                          </div>
                        )}

                        {/* Model Delivered - Show Candidate Status */}
                        {currentTask.status === 'Delivered' && (
                          <div className="space-y-4">
                            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="h-5 w-5 text-green-400" />
                                  <span className="text-white font-medium">Model Delivered</span>
                                </div>
                                <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                                  Candidate
                                </Badge>
                              </div>
                              <div className="text-sm text-green-300">
                                Model trained successfully and delivered to 0G Storage
                              </div>
                              {currentTask.modelRootHash && (
                                <div className="text-xs text-green-200 mt-1 font-mono">
                                  Hash: {currentTask.modelRootHash.slice(0, 20)}...
                                </div>
                              )}
                            </div>
                            
                            <div className="text-center">
                              <Button
                                onClick={async () => {
                                  if (!currentTask.modelRootHash || !address) return
                                  
                                  try {
                                    const result = await activateModel(agentId, currentTask.modelRootHash)
                                    if (result) {
                                      toast({
                                        title: 'Model Activated',
                                        description: 'Model is now active for this agent',
                                        action: result.chainLink ? (
                                          <ToastAction 
                                            altText="View on chain"
                                            onClick={() => window.open(result.chainLink, '_blank')}
                                          >
                                            View on chain
                                          </ToastAction>
                                        ) : undefined
                                      })
                                      // Refresh to show new status
                                      setTimeout(() => window.location.reload(), 2000)
                                    }
                                  } catch (error) {
                                    toast({
                                      variant: 'destructive',
                                      title: 'Activation Failed',
                                      description: error instanceof Error ? error.message : 'Failed to activate model'
                                    })
                                  }
                                }}
                                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                                disabled={!currentTask.modelRootHash || !address}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Make Active
                              </Button>
                              <p className="text-xs text-purple-300 mt-2">
                                This will set the trained model as the active version for your agent
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Model Finished/Acknowledged */}
                        {currentTask.status === 'Finished' && (
                          <div className="p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-blue-400" />
                                <span className="text-white font-medium">Training Complete</span>
                              </div>
                              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                                Active
                              </Badge>
                            </div>
                            <div className="text-sm text-blue-300">
                              Model has been activated and is now live for this agent
                            </div>
                          </div>
                        )}

                        {/* Failed Status */}
                        {currentTask.status === 'Failed' && (
                          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                            <div className="flex items-center space-x-2 mb-2">
                              <AlertCircle className="h-5 w-5 text-red-400" />
                              <span className="text-white font-medium">Training Failed</span>
                            </div>
                            <div className="text-sm text-red-300">
                              {currentTask.error || 'Training encountered an error'}
                            </div>
                          </div>
                        )}

                        {/* View on Chain Links */}
                        <div className="flex justify-center space-x-4 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://chainscan-galileo.0g.ai/tx/${currentTask.id}`, '_blank')}
                            className="text-purple-300 border-purple-300 hover:bg-purple-300 hover:text-purple-900"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View on Chain
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-purple-200">
                        No active training task
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-white/10">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>

                  <Button
                    onClick={nextStep}
                    disabled={!canProceedToStep(currentStep + 1) || currentStep === 6}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Collapsible Help Section */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm mt-4">
              <CardHeader className="pb-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowHelp(!showHelp)}
                  className="w-full justify-between text-white hover:bg-white/10 p-0"
                >
                  <span className="font-medium">Help & Documentation</span>
                  {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CardHeader>
              {showHelp && (
                <CardContent className="space-y-6">
                  {/* Real SDK Integration Info */}
                  <div>
                    <h4 className="font-semibold text-white mb-3">✅ Real SDK Integration</h4>
                    <p className="text-sm text-purple-200 mb-3">
                      Connected to @0glabs/0g-serving-broker v0.2.14. All operations use real blockchain calls.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded text-sm">
                        <div className="font-medium text-white">🔗 0G Storage Upload</div>
                        <div className="text-purple-200">Real dataset upload to 0G Storage</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded text-sm">
                        <div className="font-medium text-white">🤖 6 AI Models</div>
                        <div className="text-purple-200">DistilBERT, Llama, DeepSeek, GPT-3.5, Code Llama, Mistral</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded text-sm">
                        <div className="font-medium text-white">📡 Provider API</div>
                        <div className="text-purple-200">Real task monitoring via 0G provider endpoints</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded text-sm">
                        <div className="font-medium text-white">💰 Real Payments</div>
                        <div className="text-purple-200">Automatic micropayments on 0G Network</div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Guide */}
                  <div>
                    <h4 className="font-semibold text-white mb-3">📋 Quick Guide</h4>
                    <div className="space-y-2 text-sm">
                      {[
                        'Create Fine-tuning account with minimum 0.01 OG',
                        'Upload training dataset (JSONL/JSON/TXT format)',
                        'Select base model from 6 available options',
                        'Configure training parameters or use presets',
                        'Start fine-tuning and monitor progress',
                        'Download and acknowledge completed model'
                      ].map((step, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 text-white text-xs flex items-center justify-center mt-0.5 flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-purple-200">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Documentation Link */}
                  <div className="pt-3 border-t border-white/10">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      View Full Documentation
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>

        {/* Account Bootstrap Modal for new wallet onboarding (per requirements) */}
        <AccountBootstrapModal
          isOpen={showCreateModal || showTopUpModal}
          onClose={() => {
            setShowCreateModal(false)
            setShowTopUpModal(false)
          }}
          account={bootstrapAccount}
          loading={bootstrapLoading}
          error={bootstrapError}
          onCreateAccount={createAccount}
          onDepositFunds={depositFunds}
        />
      </div>
    </div>
  )
}