// app/agents/[id]/fine-tune/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { useWalletClient } from 'wagmi'
import { walletClientToSigner } from '@/lib/utils/wagmi-utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Image,
  FileText
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { 
  ALL_MODELS, 
  MODEL_CATEGORIES, 
  getModelById, 
  validateDatasetForModel,
  getEstimatedTrainingTime,
  type FineTuneModel 
} from '@/lib/compute/fine-tune-models'
import { validateUserWalletClient } from '@/lib/compute/wallet-client'

interface AccountInfo {
  balance: string
  needsTopUp: boolean
}

interface TaskInfo {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress?: number
  logs?: string[]
  createdAt: string
  completedAt?: string
}

export default function FineTunePage() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const tokenId = params.id as string

  // State
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [tasks, setTasks] = useState<TaskInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('llama-3.3-70b')
  const [steps, setSteps] = useState(500)
  const [learningRate, setLearningRate] = useState(0.00005)
  const [datasetFile, setDatasetFile] = useState<File | null>(null)
  const [datasetRoot, setDatasetRoot] = useState<string>('')
  const [dataSize, setDataSize] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [walletValidation, setWalletValidation] = useState<{
    isValid: boolean
    errors: string[]
    warnings: string[]
    userAddress?: string
    balance?: string
    chainId?: number
  } | null>(null)

  // Validate wallet when wallet client changes
  useEffect(() => {
    if (walletClient && isConnected) {
      try {
        walletClientToSigner(walletClient).then(signer => {
          validateUserWalletClient(signer).then(result => {
            // Адаптируем результат к ожидаемому типу
            setWalletValidation({
              isValid: result.isValid,
              errors: result.error ? [result.error] : [],
              warnings: [],
              userAddress: result.address,
              balance: result.balance,
              chainId: result.chainId ? parseInt(result.chainId) : undefined
            })
          })
        }).catch(error => {
          console.error('Failed to create signer:', error)
          setWalletValidation(null)
        })
      } catch (error) {
        console.error('Failed to create signer:', error)
        setWalletValidation(null)
      }
    } else {
      setWalletValidation(null)
    }
  }, [walletClient, isConnected])

  // Load account info and tasks
  useEffect(() => {
    if (isConnected && address) {
      loadAccountInfo()
      loadTasks()
    }
  }, [isConnected, address])

  const loadAccountInfo = async () => {
    try {
      const response = await fetch('/api/compute/fine-tune/account')
      if (response.ok) {
        const data = await response.json()
        setAccountInfo(data)
      }
    } catch (error) {
      console.error('Failed to load account info:', error)
    }
  }

  const loadTasks = async () => {
    try {
      const response = await fetch('/api/compute/fine-tune/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    }
  }

  // Upload dataset
  const uploadDataset = async () => {
    console.log('[uploadDataset] Starting upload process...')
    console.log('[uploadDataset] Current state:', {
      datasetFile: datasetFile ? {
        name: datasetFile.name,
        size: datasetFile.size,
        type: datasetFile.type
      } : null,
      isUploading,
      selectedModel,
      tokenId
    })
    
    if (!datasetFile) {
      console.log('[uploadDataset] No dataset file selected')
      toast({
        title: 'Error',
        description: 'Please select a dataset file',
        variant: 'destructive'
      })
      return
    }

    console.log('[uploadDataset] Dataset file details:', {
      name: datasetFile.name,
      size: datasetFile.size,
      type: datasetFile.type,
      lastModified: datasetFile.lastModified
    })

    // Validate dataset for selected model
    const model = getModelById(selectedModel)
    if (model) {
      const validation = validateDatasetForModel(
        selectedModel, 
        dataSize || 100, 
        datasetFile.name.split('.').pop() || ''
      )
      
      if (!validation.isValid) {
        console.log('[uploadDataset] Dataset validation failed:', validation.errors)
        toast({
          title: 'Dataset Validation Failed',
          description: validation.errors.join(', '),
          variant: 'destructive'
        })
        return
      }

      if (validation.warnings.length > 0) {
        console.warn('[uploadDataset] Dataset warnings:', validation.warnings)
      }
    }

    console.log('[uploadDataset] Setting isUploading to true')
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', datasetFile)
      formData.append('agentId', tokenId)
      
      console.log('[uploadDataset] FormData created, making API request to /api/compute/fine-tune/upload')

      const response = await fetch('/api/compute/fine-tune/upload', {
        method: 'POST',
        body: formData
      })

      console.log('[uploadDataset] API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[uploadDataset] Upload successful:', data)
        setDatasetRoot(data.rootHash)
        setDataSize(data.dataSize || 0)
        toast({
          title: 'Success',
          description: 'Dataset uploaded successfully'
        })
      } else {
        const errorText = await response.text()
        console.error('[uploadDataset] Upload failed with response:', errorText)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          errorData = { error: errorText || 'Upload failed' }
        }
        
        throw new Error(errorData.error || errorData.details || 'Upload failed')
      }
    } catch (error) {
      console.error('[uploadDataset] Upload error:', error)
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      console.log('[uploadDataset] Setting isUploading to false')
      setIsUploading(false)
    }
  }

  // Start fine-tuning with user wallet
  const startFineTuning = async () => {
    if (!datasetRoot) {
      toast({
        title: 'Error',
        description: 'Please upload a dataset first',
        variant: 'destructive'
      })
      return
    }

    if (!isConnected || !walletClient) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to start fine-tuning',
        variant: 'destructive'
      })
      return
    }

    if (walletValidation && !walletValidation.isValid) {
      toast({
        title: 'Wallet Issues',
        description: walletValidation.errors.join(', '),
        variant: 'destructive'
      })
      return
    }

    if (accountInfo?.needsTopUp) {
      toast({
        title: 'Insufficient Balance',
        description: 'Please deposit funds to your fine-tuning account first',
        variant: 'destructive'
      })
      return
    }

    setIsStarting(true)
    try {
      console.log('Starting fine-tuning with user wallet:', {
        agentId: tokenId,
        datasetRootHash: datasetRoot,
        dataSize,
        baseModel: selectedModel,
        steps,
        learningRate,
        userAddress: address
      })

      // Use new wallet endpoint
      const response = await fetch('/api/compute/wallet/fine-tune', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: tokenId,
          datasetRootHash: datasetRoot,
          baseModel: selectedModel,
          steps,
          learningRate,
          dataSize,
          // Wallet info will be extracted on server side
          userAddress: address
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.taskId) {
          toast({
            title: 'Fine-tuning Started!',
            description: `Task created: ${data.taskId.slice(0, 8)}...`
          })
          // Reload tasks
          loadTasks()
        } else {
          toast({
            title: 'Task Created',
            description: 'Fine-tuning task has been submitted successfully'
          })
        }
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start fine-tuning')
      }
    } catch (error) {
      console.error('Fine-tuning error:', error)
      toast({
        title: 'Failed to Start Fine-tuning',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setIsStarting(false)
    }
  }

  const selectedModelInfo = getModelById(selectedModel)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/agents">
            <Button variant="ghost" className="text-white hover:bg-white/10 mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            Fine-tune Agent #{tokenId}
          </h1>
          <p className="text-purple-200">
            Train your agent with custom data using 0G Compute Network
          </p>
          
          {/* Wallet Connection Warning */}
          {!isConnected && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-4">
              <Wallet className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                <div className="flex items-center justify-between">
                  <span>Please connect your wallet to start fine-tuning. You'll need to sign transactions for deposits and task creation.</span>
                  <Button variant="outline" size="sm" className="ml-4">
                    Connect Wallet
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Wallet Validation Warnings */}
          {walletValidation && !walletValidation.isValid && (
            <Alert className="bg-red-500/10 border-red-500/30 mt-4">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200">
                <div className="space-y-1">
                  <div className="font-semibold">Wallet Issues:</div>
                  {walletValidation.errors.map((error, index) => (
                    <div key={index} className="text-sm">• {error}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Wallet Warnings */}
          {walletValidation && walletValidation.warnings.length > 0 && (
            <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-4">
              <Info className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                <div className="space-y-1">
                  {walletValidation.warnings.map((warning, index) => (
                    <div key={index} className="text-sm">• {warning}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dataset Upload */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 1: Upload Training Dataset
                </h3>
                
                <div className="space-y-4">
                  {/* Dataset Format Information */}
                  <Alert className="bg-blue-500/10 border-blue-500/30">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-200">
                      <div className="space-y-2">
                        <div className="font-semibold">Required Dataset Format:</div>
                        <div className="text-sm space-y-1">
                          <div>• <strong>JSONL format</strong> - Each line is a JSON object</div>
                          <div>• <strong>Messages structure</strong> - Use "messages" array with "role" and "content"</div>
                          <div>• <strong>Roles:</strong> "system", "user", "assistant"</div>
                          <div>• <strong>Size:</strong> 100-10,000 examples (varies by model)</div>
                        </div>
                        
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-blue-300 hover:text-blue-200">
                            Show Example Format
                          </summary>
                          <pre className="text-xs mt-2 bg-black/30 p-3 rounded overflow-auto text-green-300">
{`{"messages": [
  {"role": "system", "content": "You are a helpful AI assistant."},
  {"role": "user", "content": "What is machine learning?"},
  {"role": "assistant", "content": "Machine learning is a subset of AI..."}
]}
{"messages": [
  {"role": "user", "content": "Explain neural networks"},
  {"role": "assistant", "content": "Neural networks are computing systems..."}
]}`}
                          </pre>
                          <div className="mt-2">
                            <a 
                              href="/example-dataset.jsonl" 
                              download
                              className="text-sm text-blue-300 hover:text-blue-200 underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Download Example Dataset
                            </a>
                          </div>
                        </details>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label className="text-purple-200">Select Dataset File</Label>
                    <Input
                      type="file"
                      accept=".jsonl,.json,.txt"
                      onChange={(e) => setDatasetFile(e.target.files?.[0] || null)}
                      className="bg-white/10 border-white/20 text-white file:bg-purple-600 file:text-white file:border-0"
                    />
                    {datasetFile && (
                      <div className="text-sm text-purple-200">
                        Selected: {datasetFile.name} ({(datasetFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={(e) => {
                      console.log('[Button Click] Upload Dataset button clicked!', {
                        event: e,
                        datasetFile: datasetFile ? datasetFile.name : 'null',
                        isUploading,
                        disabled: !datasetFile || isUploading
                      })
                      uploadDataset()
                    }} 
                    disabled={!datasetFile || isUploading}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {isUploading ? (
                      <>
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Dataset
                      </>
                    )}
                  </Button>

                  {datasetRoot && (
                    <Alert className="bg-green-500/10 border-green-500/30">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-200">
                        Dataset uploaded successfully! Root hash: {datasetRoot.slice(0, 16)}...
                        {dataSize > 0 && ` (${dataSize} examples)`}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </Card>

            {/* Model Selection */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 2: Select Base Model
                </h3>
                
                <Tabs defaultValue="recommended" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-white/10">
                    <TabsTrigger value="recommended" className="text-white data-[state=active]:bg-purple-600">
                      <Zap className="mr-1 h-3 w-3" />
                      Recommended
                    </TabsTrigger>
                    <TabsTrigger value="language-generation" className="text-white data-[state=active]:bg-purple-600">
                      <FileText className="mr-1 h-3 w-3" />
                      Text Gen
                    </TabsTrigger>
                    <TabsTrigger value="reasoning" className="text-white data-[state=active]:bg-purple-600">
                      <Brain className="mr-1 h-3 w-3" />
                      Reasoning
                    </TabsTrigger>
                    <TabsTrigger value="text-classification" className="text-white data-[state=active]:bg-purple-600">
                      <FileText className="mr-1 h-3 w-3" />
                      Classification
                    </TabsTrigger>
                  </TabsList>
                  
                  {Object.entries(MODEL_CATEGORIES).map(([categoryKey, category]) => (
                    <TabsContent key={categoryKey} value={categoryKey} className="space-y-3 mt-4">
                      <div className="text-sm text-purple-200 mb-3">{category.description}</div>
                      
                      <div className="space-y-2">
                        {category.models.map((model) => (
                          <div
                            key={model.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedModel === model.id 
                                ? 'bg-purple-600/30 border-purple-400' 
                                : 'bg-white/5 border-white/20 hover:bg-white/10'
                            }`}
                            onClick={() => setSelectedModel(model.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-white">{model.name}</span>
                                  {model.isRecommended && (
                                    <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-300">
                                      Recommended
                                    </Badge>
                                  )}
                                  {model.provider === 'predefined' && (
                                    <Badge variant="outline" className="text-xs border-blue-400 text-blue-300">
                                      Official
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-purple-200 mb-2">{model.description}</p>
                                
                                {model.requirements && (
                                  <div className="text-xs text-purple-300 space-y-1">
                                    <div>📊 Dataset: {model.requirements.minDatasetSize}-{model.requirements.maxDatasetSize} examples</div>
                                    <div>⏱️ Training time: {model.requirements.estimatedTrainingTime}</div>
                                    <div>📁 Formats: {model.requirements.supportedFormats?.join(', ')}</div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="ml-3">
                                <div className={`w-4 h-4 rounded-full border-2 ${
                                  selectedModel === model.id 
                                    ? 'bg-purple-500 border-purple-500' 
                                    : 'border-white/30'
                                }`} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </Card>

            {/* Training Parameters */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 3: Training Parameters
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-purple-200">Training Steps</Label>
                    <Input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(parseInt(e.target.value) || 500)}
                      className="bg-white/10 border-white/20 text-white mt-2"
                      min="100"
                      max="5000"
                    />
                    <div className="text-xs text-purple-300 mt-1">
                      Recommended: 500-1000 steps
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-purple-200">Learning Rate</Label>
                    <Input
                      type="number"
                      value={learningRate}
                      onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.00005)}
                      className="bg-white/10 border-white/20 text-white mt-2"
                      step="0.00001"
                      min="0.00001"
                      max="0.001"
                    />
                    <div className="text-xs text-purple-300 mt-1">
                      Recommended: 0.00005 for most models
                    </div>
                  </div>
                </div>

                {selectedModelInfo && (
                  <Alert className="bg-blue-500/10 border-blue-500/30 mt-4">
                    <Info className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-200">
                      <div className="space-y-1">
                        <div className="font-semibold">Selected Model: {selectedModelInfo.name}</div>
                        <div className="text-sm">Type: {selectedModelInfo.type}</div>
                        <div className="text-sm">Estimated training time: {getEstimatedTrainingTime(selectedModel)}</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Separator className="my-6 bg-white/20" />

                <Button 
                  onClick={startFineTuning}
                  disabled={!datasetRoot || !isConnected || isStarting || (walletValidation !== null && !walletValidation.isValid)}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3"
                >
                  {isStarting ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Starting Fine-tuning...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start Fine-tuning
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Account Status</h3>
                
                {isConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-green-200">Wallet Connected</span>
                    </div>
                    
                    {walletValidation && (
                      <div className="text-sm space-y-1">
                        <div className="text-purple-200">Address: {walletValidation.userAddress?.slice(0, 6)}...{walletValidation.userAddress?.slice(-4)}</div>
                        {walletValidation.balance && (
                          <div className="text-purple-200">Balance: {parseFloat(walletValidation.balance).toFixed(4)} OG</div>
                        )}
                        {walletValidation.chainId && (
                          <div className="text-purple-200">Network: {walletValidation.chainId === 16601 ? 'Galileo Testnet V3' : `Chain ${walletValidation.chainId}`}</div>
                        )}
                      </div>
                    )}

                    {accountInfo && (
                      <div className="space-y-2">
                        <div className="text-sm text-purple-200">
                          Fine-tune Balance: {accountInfo.balance} {NATIVE_SYMBOL}
                        </div>
                        {accountInfo.needsTopUp && (
                          <Alert className="bg-yellow-500/10 border-yellow-500/30">
                            <AlertCircle className="h-4 w-4 text-yellow-400" />
                            <AlertDescription className="text-yellow-200 text-xs">
                              Low balance. Please deposit funds.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Wallet className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-purple-200 text-sm">Connect your wallet to view account status</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Active Tasks */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Fine-tuning Tasks</h3>
                
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white">
                            Task {task.id.slice(0, 8)}...
                          </span>
                          <Badge 
                            variant={
                              task.status === 'completed' ? 'default' :
                              task.status === 'failed' ? 'destructive' :
                              task.status === 'running' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {task.status}
                          </Badge>
                        </div>
                        
                        {task.progress !== undefined && (
                          <Progress value={task.progress} className="h-2 mb-2" />
                        )}
                        
                        <div className="text-xs text-purple-300">
                          Created: {new Date(task.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    
                    {tasks.length > 3 && (
                      <div className="text-center">
                        <Button variant="ghost" size="sm" className="text-purple-300 hover:text-white">
                          View All Tasks ({tasks.length})
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                    <p className="text-purple-200 text-sm">No fine-tuning tasks yet</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}