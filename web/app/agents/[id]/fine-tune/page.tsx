'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
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
import { 
  Brain, 
  Upload, 
  Loader2, 
  ArrowLeft,
  FileUp,
  Bot,
  Check,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { uploadToStorage } from '@/lib/storage/client-server'

export default function FineTunePage() {
  const params = useParams()
  const router = useRouter()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()
  
  const tokenId = params.id as string
  
  // States
  const [dataset, setDataset] = useState<File | null>(null)
  const [datasetRoot, setDatasetRoot] = useState('')
  const [uploading, setUploading] = useState(false)
  const [baseModel, setBaseModel] = useState('llama-3.3-70b')
  const [steps, setSteps] = useState(500)
  const [learningRate, setLearningRate] = useState(0.00005)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string>('')
  const [isStarting, setIsStarting] = useState(false)
  const [isPolling, setIsPolling] = useState(false)

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

    setUploading(true)
    try {
      const result = await uploadToStorage(dataset, dataset.name)
      setDatasetRoot(result.rootHash)
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
      setUploading(false)
    }
  }

  // Start fine-tuning
  const startFineTuning = async () => {
    if (!datasetRoot) {
      toast({
        title: 'Error',
        description: 'Please upload a dataset first',
        variant: 'destructive'
      })
      return
    }

    if (!walletClient || !publicClient) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
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
          baseModel,
          steps,
          lr: Math.floor(learningRate * 1e9)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start fine-tuning')
      }

      const { jobId: newJobId } = await response.json()
      setJobId(newJobId)
      setJobStatus('REQUESTED')
      
      toast({
        title: 'Fine-tuning started!',
        description: `Job ID: ${newJobId.slice(0, 8)}...`
      })

      // Start polling for status
      startPolling(newJobId)
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

  // Poll job status
  const startPolling = (jobIdToCheck: string) => {
    setIsPolling(true)
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/compute/fine-tune?id=${jobIdToCheck}`)
        if (response.ok) {
          const data = await response.json()
          setJobStatus(data.status || 'REQUESTED')
          
          if (data.status === 'COMPLETED' || data.statusCode === 2) {
            clearInterval(interval)
            setIsPolling(false)
            toast({
              title: 'Training Complete!',
              description: 'Your agent has been successfully fine-tuned'
            })
          }
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 5000) // Poll every 5 seconds

    // Clean up interval after 30 minutes
    setTimeout(() => {
      clearInterval(interval)
      setIsPolling(false)
    }, 30 * 60 * 1000)
  }

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
            Train your agent with custom data
          </p>
        </div>

        {/* Main Content */}
        {jobId && jobStatus ? (
          // Training Progress View
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-2xl mx-auto">
            <div className="p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6">
                {jobStatus === 'COMPLETED' ? (
                  <div className="w-full h-full rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-12 h-12 text-green-400" />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                  </div>
                )}
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-2">
                {jobStatus === 'COMPLETED' ? 'Training Complete!' : 'Training in Progress...'}
              </h2>
              
              <Alert className="bg-purple-500/10 border-purple-500/30 mt-6">
                <AlertCircle className="h-4 w-4 text-purple-400" />
                <AlertDescription className="text-purple-200">
                  Job ID: <code className="bg-white/10 px-2 py-1 rounded text-xs">{jobId}</code>
                  <br />
                  Status: {jobStatus}
                </AlertDescription>
              </Alert>

              {jobStatus === 'COMPLETED' ? (
                <div className="mt-8 space-y-4">
                  <Link href={`/agent/${tokenId}/chat`}>
                    <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                      <Bot className="mr-2 h-5 w-5" />
                      Chat with Enhanced Agent
                    </Button>
                  </Link>
                  <Link href="/agents">
                    <Button size="lg" variant="outline" className="ml-4 border-purple-500/50 text-purple-300 hover:bg-purple-500/10">
                      Back to Agents
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-purple-200 mt-4">
                  This may take several minutes. You can safely leave this page.
                </p>
              )}
            </div>
          </Card>
        ) : (
          // Configuration Form
          <div className="max-w-2xl mx-auto space-y-6">
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
                          disabled={uploading}
                          className="w-full bg-purple-500 hover:bg-purple-600"
                        >
                          {uploading ? (
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
            <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border-white/20">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  Step 3: Start Training
                </h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-purple-200">Model:</span>
                    <span className="text-white font-medium">{baseModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Steps:</span>
                    <span className="text-white font-medium">{steps}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-200">Learning Rate:</span>
                    <span className="text-white font-medium">{learningRate}</span>
                  </div>
                </div>
                
                <Button
                  onClick={startFineTuning}
                  disabled={!datasetRoot || isStarting}
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
