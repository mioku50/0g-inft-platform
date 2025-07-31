'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Icons
import { 
  ArrowLeft, 
  Upload, 
  Play, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Wallet,
  ExternalLink,
  Info,
  Zap,
  Brain,
  FileText,
  Download,
  Eye
} from 'lucide-react'

// Hooks and utilities
import { useFineTuning } from '@/hooks/useFineTuning'
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

export default function FineTunePage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  const { address, isConnected } = useAccount()
  
  // Fine-tuning hook
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
    clearError
  } = useFineTuning()

  // Local state
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [datasetFile, setDatasetFile] = useState<File | null>(null)
  const [datasetInfo, setDatasetInfo] = useState<any>(null)
  const [uploadedDataset, setUploadedDataset] = useState<{ rootHash: string; size: number } | null>(null)
  const [trainingParams, setTrainingParams] = useState(DEFAULT_TRAINING_PARAMS)
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [currentStep, setCurrentStep] = useState<'account' | 'dataset' | 'model' | 'params' | 'train' | 'monitor'>('account')
  const [taskId, setTaskId] = useState('')
  const [taskLogs, setTaskLogs] = useState<string[]>([])

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

  // Auto-advance steps based on state
  useEffect(() => {
    if (!account?.exists) {
      setCurrentStep('account')
    } else if (!uploadedDataset) {
      setCurrentStep('dataset')
    } else if (!selectedModel) {
      setCurrentStep('model')
    } else if (currentTask) {
      setCurrentStep('monitor')
    }
  }, [account, uploadedDataset, selectedModel, currentTask])

  // Handle dataset file selection
  const handleDatasetUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setDatasetFile(file)
    
    // Validate dataset
    const validation = await validateDataset(file)
    setDatasetInfo(validation)
    
    if (validation && validation.isValid) {
      // Upload to 0G Storage
      const result = await uploadDataset(file)
      if (result) {
        setUploadedDataset(result)
        setCurrentStep('model')
      }
    }
  }

  // Handle training start
  const handleStartTraining = async () => {
    if (!uploadedDataset || !selectedModel || !selectedProvider) {
      toast({
        title: 'Missing Requirements',
        description: 'Please upload dataset and select model and provider',
        variant: 'destructive'
      })
      return
    }

    // Acknowledge provider if needed
    await acknowledgeProvider(selectedProvider)
    
    // Create training task
    const newTaskId = await createTask({
      agentId,
      modelId: selectedModel,
      datasetHash: uploadedDataset.rootHash,
      datasetSize: uploadedDataset.size,
      trainingParams,
      providerAddress: selectedProvider
    })
    
    if (newTaskId) {
      setTaskId(newTaskId)
      setCurrentStep('monitor')
      
      // Get initial task info
      const task = await getTask(newTaskId, selectedProvider)
      if (task) {
        setCurrentTask(task)
      }
    }
  }

  // Monitor task progress
  const refreshTaskStatus = async () => {
    if (!taskId || !selectedProvider) return
    
    const task = await getTask(taskId, selectedProvider)
    if (task) {
      setCurrentTask(task)
      
      // Get logs
      const logs = await getTaskLogs(taskId, selectedProvider)
      if (logs) {
        setTaskLogs(logs)
      }
    }
  }

  // Handle model acknowledgment
  const handleAcknowledgeModel = async () => {
    if (!taskId || !selectedProvider) return
    
    await acknowledgeModel(taskId, selectedProvider)
    await refreshTaskStatus()
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground text-center mb-6">
              Please connect your wallet to access Fine-tuning features
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/agents/${agentId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agent
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Fine-tune Agent</h1>
          <p className="text-muted-foreground">Train your AI agent with custom data on 0G Compute Network</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step Indicator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Fine-tuning Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {[
                  { id: 'account', label: 'Account', icon: Wallet },
                  { id: 'dataset', label: 'Dataset', icon: Upload },
                  { id: 'model', label: 'Model', icon: Brain },
                  { id: 'params', label: 'Parameters', icon: Zap },
                  { id: 'train', label: 'Training', icon: Play },
                  { id: 'monitor', label: 'Monitor', icon: Eye }
                ].map((step, index) => {
                  const Icon = step.icon
                  const isActive = currentStep === step.id
                  const isCompleted = ['account', 'dataset', 'model'].includes(step.id) && 
                                   (step.id === 'account' ? account?.exists : 
                                    step.id === 'dataset' ? uploadedDataset :
                                    step.id === 'model' ? selectedModel : false)
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        isCompleted ? 'bg-green-500 border-green-500 text-white' :
                        isActive ? 'bg-blue-500 border-blue-500 text-white' :
                        'border-gray-300 text-gray-400'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs mt-1">{step.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step Content */}
          <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as any)}>
            {/* Account Setup */}
            <TabsContent value="account">
              <Card>
                <CardHeader>
                  <CardTitle>Fine-tuning Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!account?.exists ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold mb-2">Create Fine-tuning Account</h3>
                      <p className="text-muted-foreground mb-4">
                        You need a Fine-tuning account to pay for training services
                      </p>
                      <div className="flex items-center gap-2 justify-center mb-4">
                        <Label htmlFor="deposit">Initial deposit:</Label>
                        <Input
                          id="deposit"
                          type="number"
                          step="0.001"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">OG</span>
                      </div>
                      <Button 
                        onClick={() => initializeAccount(parseFloat(depositAmount))}
                        disabled={loading}
                      >
                        {loading ? 'Creating...' : 'Create Account'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-medium">Account Active</span>
                        </div>
                        <Badge variant="secondary">Ready</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Available Balance</Label>
                          <p className="text-2xl font-bold">{account.balance} OG</p>
                        </div>
                        <div>
                          <Label>Locked Balance</Label>
                          <p className="text-2xl font-bold text-orange-600">{account.locked} OG</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="Amount to deposit"
                        />
                        <Button onClick={() => deposit(parseFloat(depositAmount))} disabled={loading}>
                          Deposit
                        </Button>
                      </div>
                      
                      <Button 
                        onClick={() => setCurrentStep('dataset')} 
                        className="w-full"
                      >
                        Continue to Dataset Upload
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dataset Upload */}
            <TabsContent value="dataset">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Training Dataset</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!uploadedDataset ? (
                    <div>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-semibold mb-2">Upload Training Data</h3>
                        <p className="text-muted-foreground mb-4">
                          Supported formats: .jsonl, .json, .txt
                        </p>
                        <Input
                          type="file"
                          accept=".jsonl,.json,.txt"
                          onChange={handleDatasetUpload}
                          className="w-full"
                        />
                      </div>
                      
                      {/* Dataset Info */}
                      {datasetInfo && (
                        <div className="mt-4 space-y-2">
                          <h4 className="font-medium">Dataset Validation</h4>
                          {datasetInfo.isValid ? (
                            <Alert>
                              <CheckCircle className="h-4 w-4" />
                              <AlertDescription>
                                Dataset is valid! {datasetInfo.stats.totalExamples} examples found.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                {datasetInfo.errors.join(', ')}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Dataset uploaded successfully! Root hash: {uploadedDataset.rootHash.slice(0, 20)}...
                        </AlertDescription>
                      </Alert>
                      
                      <Button onClick={() => setCurrentStep('model')} className="w-full">
                        Continue to Model Selection
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Model Selection */}
            <TabsContent value="model">
              <Card>
                <CardHeader>
                  <CardTitle>Select Base Model</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {getActiveModels().map((model) => (
                      <div
                        key={model.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedModel === model.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                        onClick={() => setSelectedModel(model.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{model.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{model.description}</p>
                            <div className="flex gap-2">
                              <Badge variant="secondary">{model.type}</Badge>
                              <Badge variant="outline">{model.requirements.trainingTime}</Badge>
                            </div>
                          </div>
                          {selectedModel === model.id && (
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={() => setCurrentStep('params')} 
                    disabled={!selectedModel}
                    className="w-full"
                  >
                    Continue to Training Parameters
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Training Parameters */}
            <TabsContent value="params">
              <Card>
                <CardHeader>
                  <CardTitle>Training Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="epochs">Training Epochs</Label>
                      <Input
                        id="epochs"
                        type="number"
                        value={trainingParams.num_train_epochs}
                        onChange={(e) => setTrainingParams(prev => ({
                          ...prev,
                          num_train_epochs: parseInt(e.target.value)
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="batch_size">Batch Size</Label>
                      <Input
                        id="batch_size"
                        type="number"
                        value={trainingParams.per_device_train_batch_size}
                        onChange={(e) => setTrainingParams(prev => ({
                          ...prev,
                          per_device_train_batch_size: parseInt(e.target.value)
                        }))}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => setTrainingParams(DEFAULT_TRAINING_PARAMS)}
                    >
                      Use Recommended
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('train')}
                      className="flex-1"
                    >
                      Continue to Training
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Start Training */}
            <TabsContent value="train">
              <Card>
                <CardHeader>
                  <CardTitle>Start Fine-tuning</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Model:</span>
                      <Badge>{selectedModel}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Dataset:</span>
                      <span className="text-sm font-mono">{uploadedDataset?.rootHash.slice(0, 20)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Training Epochs:</span>
                      <span>{trainingParams.num_train_epochs}</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <Button 
                    onClick={handleStartTraining}
                    disabled={loading || !account?.exists || !uploadedDataset || !selectedModel}
                    className="w-full"
                    size="lg"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {loading ? 'Starting Training...' : 'Start Fine-tuning'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monitor Training */}
            <TabsContent value="monitor">
              <Card>
                <CardHeader>
                  <CardTitle>Training Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentTask ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Task ID:</span>
                        <span className="font-mono text-sm">{currentTask.id}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <Badge variant={
                          currentTask.status === 'Finished' ? 'default' :
                          currentTask.status === 'Failed' ? 'destructive' :
                          'secondary'
                        }>
                          {TASK_STATUS[currentTask.status] || currentTask.status}
                        </Badge>
                      </div>
                      
                      {currentTask.status === 'Delivered' && (
                        <div className="space-y-2">
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                              Model training completed and delivered!
                            </AlertDescription>
                          </Alert>
                          <Button onClick={handleAcknowledgeModel} className="w-full">
                            <Download className="h-4 w-4 mr-2" />
                            Acknowledge & Download Model
                          </Button>
                        </div>
                      )}
                      
                      {taskLogs.length > 0 && (
                        <div>
                          <Label>Training Logs</Label>
                          <div className="bg-gray-100 p-3 rounded text-sm font-mono max-h-40 overflow-y-auto">
                            {taskLogs.map((log, index) => (
                              <div key={index}>{log}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <Button onClick={refreshTaskStatus} variant="outline" className="w-full">
                        Refresh Status
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p>No active training task</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${account?.exists ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">{account?.exists ? 'Active' : 'Not Created'}</span>
              </div>
              
              {account?.exists && (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">Balance</div>
                    <div className="font-semibold">{account.balance} OG</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Locked</div>
                    <div className="font-semibold text-orange-600">{account.locked} OG</div>
                  </div>
                </>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refreshAccount}
                disabled={loading}
                className="w-full"
              >
                Refresh
              </Button>
            </CardContent>
          </Card>

          {/* Quick Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Create Fine-tuning account</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Upload training dataset</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Select base model</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Configure training</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Monitor progress</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-2" />
                <span>Download trained model</span>
              </div>
            </CardContent>
          </Card>

          {/* Help */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground mb-3">
                Learn more about Fine-tuning with 0G Compute Network
              </p>
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-3 w-3 mr-2" />
                Documentation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}