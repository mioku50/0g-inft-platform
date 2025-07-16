// web/app/mint/page.tsx
'use client'

import { useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Upload, Loader2 } from 'lucide-react'
import { uploadToStorage } from '@/lib/storage/client-browser'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'

const AI_MODELS = [
  { value: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd' },
  { value: 'deepseek-r1-70b', label: 'DeepSeek R1 70B', provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3' },
]

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleMint = async () => {
    if (!isConnected || !walletClient || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to continue",
        variant: "destructive",
      })
      return
    }

    if (!name || !description || !model || !systemPrompt) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      // 1. Upload image if exists
      let imageUrl = ''
      if (image) {
        setUploadingImage(true)
        const formData = new FormData()
        formData.append('file', image)
        
        const response = await fetch('/api/storage/upload-image', {
          method: 'POST',
          body: formData,
        })
        
        if (!response.ok) throw new Error('Failed to upload image')
        
        const data = await response.json()
        imageUrl = data.url
        setUploadingImage(false)
      }

      // 2. Prepare metadata
      const selectedModel = AI_MODELS.find(m => m.value === model)
      const metadata = {
        name,
        description,
        image: imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        model: model,
        provider: selectedModel?.provider,
        systemPrompt,
        createdAt: new Date().toISOString(),
        createdBy: address,
      }

      // 3. Upload metadata to 0G Storage
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
      const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' })
      
      const { rootHash } = await uploadToStorage(metadataFile)
      const metadataUri = `https://indexer-storage-testnet-turbo.0g.ai/${rootHash}`

      // 4. Mint NFT
      const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS
      if (!contractAddress) throw new Error('Contract address not configured')

      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: INFT_ABI,
        functionName: 'mint',
        args: [address, metadataUri, rootHash],
        account: address,
      })

      const hash = await walletClient.writeContract(request)
      
      toast({
        title: "Minting in progress",
        description: "Your AI agent is being created...",
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      
      if (receipt.status === 'success') {
        toast({
          title: "Success!",
          description: "Your AI agent has been minted successfully",
        })
        
        // Reset form
        setName('')
        setDescription('')
        setModel('')
        setSystemPrompt('')
        setImage(null)
        setImagePreview('')
      }
    } catch (error) {
      console.error('Minting error:', error)
      toast({
        title: "Minting failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setUploadingImage(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create AI Agent</CardTitle>
          <CardDescription>
            Mint your AI agent as an NFT on 0G Network
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Agent Name</Label>
            <Input
              id="name"
              placeholder="My AI Assistant"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what your AI agent does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={model} onValueChange={setModel} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select an AI model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              placeholder="You are a helpful AI assistant..."
              className="min-h-[100px]"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Agent Image (Optional)</Label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={loading}
                className="flex-1"
              />
            </div>
          </div>

          <Button
            onClick={handleMint}
            disabled={!isConnected || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploadingImage ? 'Uploading image...' : 'Minting...'}
              </>
            ) : (
              'Mint AI Agent'
            )}
          </Button>

          {!isConnected && (
            <p className="text-sm text-muted-foreground text-center">
              Please connect your wallet to mint an AI agent
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}