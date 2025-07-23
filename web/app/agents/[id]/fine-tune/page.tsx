'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { 
  Card,
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  useToast
} from '@/components/ui'
import { NATIVE_SYMBOL } from '@/lib/constants'
import { 
  Brain, 
  Upload, 
  Loader2, 
  ArrowLeft,
  FileUp,
  Bot,
  Check,
  AlertCircle,
  Download,
  FileCheck,
  Activity,
  Wallet,
  Plus
} from 'lucide-react'
import Link from 'next/link'

interface AccountInfo {
  balance: string
  exists: boolean
  needsTopUp: boolean
}

export default function FineTunePage() {
  const params = useParams()
  const router = useRouter()
  const { address } = useAccount()
  const { toast } = useToast()
  
  const tokenId = params.id as string
  
  // States
  const [dataset, setDataset] = useState<File | null>(null)
  const [datasetRoot, setDatasetRoot] = useState('')
  const [dataSize, setDataSize] = useState<number | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [baseModel, setBaseModel] = useState('llama-3.3-70b')
  const [steps, setSteps] = useState(500)
  const [learningRate, setLearningRate] = useState(0.00005)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskStatus, setTaskStatus] = useState<string>('')
  const [taskProgress, setTaskProgress] = useState<any>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [modelRootHash, setModelRootHash] = useState<string | null>(null)
  
  // Account management states
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)
  const [isCheckingAccount, setIsCheckingAccount] = useState(true)
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [isDepositing, setIsDepositing] = useState(false)

  // Load cached dataset info
  useEffect(() => {
    const cached = localStorage.getItem(`ds-${tokenId}`)
    if (cached) {
      try {
        const { root, size } = JSON.parse(cached)
        setDatasetRoot(root)
        setDataSize(size)
      } catch {}
    }
  }, [tokenId])

  // Check account status on mount
  useEffect(() => {
    if (address) {
      checkAccountStatus()
    }
  }, [address])

  const checkAccountStatus = async () => {
    try {
      setIsCheckingAccount(true)
      const response = await fetch('/api/compute/account')
      
      if (response.ok) {
        const data = await response.json()
        setAccountInfo({
          balance: data.account.balance,
          exists: data.account.exists,
          needsTopUp: data.recommendations.needsTopUp
        })
      } else {
        console.warn('Could not fetch account info')
        setAccountInfo({ balance: '0', exists: false, needsTopUp: true })
      }
    } catch (error) {
      console.error('Error checking account:', error)
      setAccountInfo({ balance: '0', exists: false, needsTopUp: true })
    } finally {
      setIsCheckingAccount(false)
    }
  }

  const handleAccountSetup = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid deposit amount',
        variant: 'destructive'
      })
      return
    }

    setIsDepositing(true)
    try {
      const response = await fetch('/api/compute/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: depositAmount,
          action: accountInfo?.exists ? 'deposit' : 'create'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to setup account')
      }

      const data = await response.json()
      toast({
        title: 'Success!',
        description: data.message
      })

      // Refresh account info
      await checkAccountStatus()

    } catch (error: any) {
      console.error('Account setup error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to setup account',
        variant: 'destructive'
      })
    } finally {
      setIsDepositing(false)
    }
  }

  // Upload dataset to 0G Storage
  const handleDatasetUpload = async () => {
    if (!dataset) {
      toast({
        title: 'Error',
        description: 'Please select a dataset file',
        variant: 'destructive'
      })
      return
    }

    if (datasetRoot) return
    setIsUploading(true)
    try {
      const form = new FormData()
      form.set('file', dataset)
      const res = await fetch('/api/storage/upload-dataset', {
        method: 'POST',
        body: form
      })
      if (!res.ok) throw new Error('Upload failed')
      const result = await res.json()
      setDatasetRoot(result.root)
      setDataSize(result.size)
      localStorage.setItem(`ds-${tokenId}`, JSON.stringify({ root: result.root, size: result.size }))
      toast({
        title: 'Success!',
        description: 'Dataset uploaded to 0G Storage'
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Error',
        description: 'Failed to upload dataset',
        variant: 'destructive'
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Get status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'Init':
        return { text: 'Initializing', color: 'text-yellow-400', icon: <Activity className="w-5 h-5" /> }
      case 'SettingUp':
        return { text: 'Setting up environment', color: 'text-orange-400', icon: <Loader2 className="w-5 h-5 animate-spin" /> }
      case 'Training':
        return { text: 'Training in progress', color: 'text-purple-400', icon: <Loader2 className="w-5 h-5 animate-spin" /> }
      case 'Trained':
        return { text: 'Training completed', color: 'text-green-400', icon: <Check className="w-5 h-5" /> }
      case 'Delivering':
        return { text: 'Uploading model', color: 'text-blue-400', icon: <Upload className="w-5 h-5" /> }
      case 'Delivered':
        return { text: 'Model ready for download', color: 'text-green-400', icon: <Download className="w-5 h-5" /> }
      case 'Finished':
        return { text: 'Task completed!', color: 'text-green-500', icon: <Check className="w-5 h-5" /> }
      case 'Failed':
        return { text: 'Task failed', color: 'text-red-400', icon: <AlertCircle className="w-5 h-5" /> }
      default:
        return { text: status, color: 'text-gray-400', icon: <Activity className="w-5 h-5" /> }
    }
  }

  // Start fine-tuning with new API
  const startFineTuning = async () => {
    if (!datasetRoot) {
      toast({
        title: 'Error',
        description: 'Please upload a dataset first',
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
      const response = await fetch('/api/compute/fine-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: tokenId,
          datasetRoot,
          dataSize,
          baseModel,
          steps,
          learningRate
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to start fine-tuning')
      }

      const data = await response.json()
      setTaskId(data.taskId)
      setTaskStatus('Init')
      
      toast({
        title: 'Fine-tuning started!',
        description: `Task ID: ${data.taskId.slice(0, 8)}... (${data.estimatedTime})`
      })

      // Start polling for status
      pollStatus(data.taskId)
    } catch (error: any) {
      console.error('Fine-tuning error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to start fine-tuning',
        variant: 'destructive'
      })
    } finally {
      setIsStarting(false)
    }
  }

  // Poll task status
  const pollStatus = (taskIdToCheck: string) => {
    setIsPolling(true)

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/compute/fine-tune?taskId=${taskIdToCheck}`)
        if (response.ok) {
          const data = await response.json()
          setTaskStatus(data.progress || 'Unknown')
          setTaskProgress(data)

          if (data.isCompleted) {
            clearInterval(interval)
            setIsPolling(false)
            setModelRootHash(data.modelInfo?.rootHash)
            await updateAgentWithNewModel(data.modelInfo?.rootHash)
            toast({
              title: 'Training Complete!',
              description: 'Your agent has been successfully fine-tuned'
            })
          } else if (data.isFailed) {
            clearInterval(interval)
            setIsPolling(false)
            toast({
              title: 'Training Failed',
              description: 'An error occurred during training',
              variant: 'destructive'
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 10000)

    setTimeout(() => {
      clearInterval(interval)
      setIsPolling(false)
    }, 2 * 60 * 60 * 1000)
  }

  // Update agent with new model
  const updateAgentWithNewModel = async (modelHash: string) => {
    if (!modelHash) return
    try {
      await fetch(`/api/agents/${tokenId}/update-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelRootHash: modelHash })
      })
    } catch (error) {
      console.error('Failed to update agent:', error)
    }
  }

  // Render account setup section
  const renderAccountSetup = () => (
    <Card className="bg-white/10 backdrop-blur-xl border-white/20 mb-6">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Wallet className="mr-2 h-5 w-5" />
          Fine-tuning Account Setup
        </h3>
        
        {isCheckingAccount ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <span className="ml-2 text-purple-200">Checking account status...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {accountInfo ? (
              <div className="bg-black/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Current Balance:</span>
                  <span className="text-white font-semibold">{accountInfo.balance} {NATIVE_SYMBOL}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Account Status:</span>
                  <Badge className={accountInfo.exists ? 'bg-green-500' : 'bg-red-500'}>
                    {accountInfo.exists ? 'Active' : 'Not Created'}
                  </Badge>
                </div>
                {accountInfo.needsTopUp && (
                  <Alert className="bg-yellow-500/10 border-yellow-500/30 mt-3">
                    <AlertCircle className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-200">
                      Insufficient balance for fine-tuning. Minimum required: 0.001 {NATIVE_SYMBOL}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : null}
            
            {(!accountInfo?.exists || accountInfo?.needsTopUp) && (
              <div className="space-y-3">
                <div>
                  <Label className="text-purple-200">Deposit Amount ({NATIVE_SYMBOL})</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="bg-white/10 border-white/20 text-white mt-2"
                    min="0.001"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Recommended: 0.01 {NATIVE_SYMBOL} (covers multiple fine-tuning sessions)
                  </p>
                </div>
                
                <Button
                  onClick={handleAccountSetup}
                  disabled={isDepositing}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  {isDepositing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {accountInfo?.exists ? 'Depositing...' : 'Creating Account...'}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {accountInfo?.exists ? 'Deposit Funds' : 'Create Account & Deposit'}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="container mx-auto py-10 px-4">
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
        </div>

        {/* Main Content */}
        {taskId && taskStatus ? (
          // Training Progress View
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-2xl mx-auto">
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className={`w-24 h-24 rounded-full bg-white/10 flex items-center justify-center ${
                  taskStatus === 'Training' ? 'animate-pulse' : ''
                }`}>
                  {getStatusInfo(taskStatus).icon}
                </div>
              </div>
              
              <h2 className={`text-3xl font-bold text-center mb-4 ${getStatusInfo(taskStatus).color}`}>
                {getStatusInfo(taskStatus).text}
              </h2>
              
              {/* Progress Details */}
              {taskProgress && (
                <div className="space-y-4">
                  <Alert className="bg-purple-500/10 border-purple-500/30">
                    <AlertCircle className="h-4 w-4 text-purple-400" />
                    <AlertDescription className="text-purple-200">
                      <div className="space-y-2">
                        <div>Task ID: <code className="bg-white/10 px-2 py-1 rounded text-xs">{taskId}</code></div>
                        <div>Status: <span className={getStatusInfo(taskStatus).color}>{taskStatus}</span></div>
                        {taskProgress.modelInfo && (
                          <div>Model Hash: <code className="bg-white/10 px-2 py-1 rounded text-xs">{taskProgress.modelInfo.rootHash?.slice(0, 16)}...</code></div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Action Buttons */}
              {taskStatus === 'Finished' ? (
                <div className="mt-8 space-y-4">
                  <Link href={`/agent/${tokenId}`}>
                    <Button size="lg" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                      <Bot className="mr-2 h-5 w-5" />
                      Chat with Enhanced Agent
                    </Button>
                  </Link>
                  <Link href="/agents">
                    <Button size="lg" variant="outline" className="w-full border-purple-500/50 text-purple-300 hover:bg-purple-500/10">
                      Back to My Agents
                    </Button>
                  </Link>
                </div>
              ) : taskStatus === 'Failed' ? (
                <div className="mt-8">
                  <Button 
                    onClick={() => window.location.reload()}
                    size="lg" 
                    className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <p className="text-purple-200 mt-6 text-center">
                  This may take 30-60 minutes. You can safely leave this page and check back later.
                </p>
              )}
            </div>
          </Card>
        ) : (
          // Configuration Form
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Account Setup */}
            {renderAccountSetup()}

            {/* Dataset Upload */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 1: Upload Training Dataset
                </h3>
                
                <div className="space-y-4">
                  {!datasetRoot ? (
                    <>
                      <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center">
                        <input
                          type="file"
                          id="dataset"
                          className="hidden"
                          accept=".json,.jsonl,.txt,.csv"
                          onChange={(e) => setDataset(e.target.files?.[0] || null)}
                        />
                        <label htmlFor="dataset" className="cursor-pointer">
                          <FileUp className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                          <p className="text-white font-medium mb-1">
                            {dataset ? dataset.name : 'Choose training data'}
                          </p>
                          <p className="text-purple-300 text-sm">
                            Supported: JSON, JSONL, TXT, CSV
                          </p>
                        </label>
                      </div>
                      
                      {dataset && (
                        <Button 
                          onClick={handleDatasetUpload}
                          disabled={isUploading}
                          className="w-full bg-purple-500 hover:bg-purple-600"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading to 0G Storage...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Dataset
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Alert className="bg-green-500/10 border-green-500/30">
                      <Check className="h-4 w-4 text-green-400" />
                      <AlertDescription className="text-green-200">
                        Dataset uploaded successfully!
                        <br />
                        <code className="text-xs">{datasetRoot.slice(0, 16)}...</code>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </Card>

            {/* Training Configuration */}
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 2: Configure Training
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-purple-200">Base Model</Label>
                    <Select value={baseModel} onValueChange={setBaseModel}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="llama-3.3-70b">Llama 3.3 70B</SelectItem>
                        <SelectItem value="deepseek-r1-70b">DeepSeek R1 70B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-purple-200">Training Steps</Label>
                    <Input
                      type="number"
                      value={steps}
                      onChange={(e) => setSteps(parseInt(e.target.value) || 500)}
                      className="bg-white/10 border-white/20 text-white mt-2"
                      min="100"
                      max="2000"
                      step="100"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-purple-200">Learning Rate</Label>
                    <Input
                      type="number"
                      value={learningRate}
                      onChange={(e) => setLearningRate(parseFloat(e.target.value) || 0.00005)}
                      className="bg-white/10 border-white/20 text-white mt-2"
                      min="0.00001"
                      max="0.001"
                      step="0.00001"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Start Training */}
            <Card className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl border-purple-500/30">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 3: Start Training
                </h3>
                
                <div className="bg-black/30 rounded-lg p-4 space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Model:</span>
                    <span className="text-white font-semibold">{baseModel}</span>
                  </div>
                  <div className="h-px bg-white/10"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Steps:</span>
                    <span className="text-white font-semibold">{steps}</span>
                  </div>
                  <div className="h-px bg-white/10"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Learning Rate:</span>
                    <span className="text-white font-semibold">{learningRate}</span>
                  </div>
                  {accountInfo && (
                    <>
                      <div className="h-px bg-white/10"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 font-medium">Account Balance:</span>
                        <span className="text-white font-semibold">{accountInfo.balance} {NATIVE_SYMBOL}</span>
                      </div>
                    </>
                  )}
                </div>
                
                <Button
                  onClick={startFineTuning}
                  disabled={!datasetRoot || isUploading || isStarting || accountInfo?.needsTopUp}
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Starting Training...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-5 w-5" />
                      Start Fine-Tuning
                    </>
                  )}
                </Button>
                
                {accountInfo?.needsTopUp && (
                  <p className="text-red-400 text-sm text-center mt-2">
                    Please deposit funds to your account first
                  </p>
                )}
                
                <p className="text-gray-400 text-sm text-center mt-4">
                  Training will be performed on 0G Compute Network
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}