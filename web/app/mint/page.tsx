'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Upload, Brain, Sparkles } from 'lucide-react'
import { uploadToStorage } from '@/lib/storage/client'
import { INFT_ABI } from '@/lib/contracts/abis'
import { uploadToStorage, uploadImage } from '@/lib/storage/client'
const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  model: z.string().min(1, 'Model selection is required'),
  capabilities: z.string().min(1, 'At least one capability is required'),
  parameters: z.string().optional(),
  image: z.any().optional(),
})

type FormData = z.infer<typeof formSchema>

export default function MintPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  })

  const { write: mintINFT, data: mintData } = useContractWrite({
    address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: INFT_ABI,
    functionName: 'mint',
  })

  const { isLoading: isMinting } = useWaitForTransaction({
    hash: mintData?.hash,
    onSuccess(data) {
      // Extract tokenId from event logs
      const tokenId = data.logs[0]?.topics[3] // Transfer event tokenId
      if (tokenId) {
        const id = parseInt(tokenId, 16)
        toast({
          title: 'Success!',
          description: 'Your AI agent has been minted',
        })
        router.push(`/chat/${id}`)
      }
    },
  })

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setValue('image', file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  
      description: 'Encrypting and uploadiconst onSubmit = async (data: FormData) => {
  // Обновите функцию onSubmit в app/mint/page.tsx:

const onSubmit = async (data: FormData) => {
  if (!isConnected || !address) {
    toast({
      title: 'Error',
      description: 'Please connect your wallet',
      variant: 'destructive',
    })
    return
  }

  setIsUploading(true)
  try {
    // Подготовка метаданных агента
    const metadata: AgentMetadata = {
      name: data.name,
      description: data.description,
      model: data.model,
      capabilities: data.capabilities.split(',').map(c => c.trim()),
      parameters: data.parameters ? JSON.parse(data.parameters) : {},
      image: null as string | null,
      version: '1.0',
      createdAt: Date.now(),
    }

    // Загружаем изображение в 0G Storage если есть
    if (data.image && imagePreview) {
      try {
        toast({
          title: 'Uploading image...',
          description: 'Uploading avatar to 0G Storage',
        })
        
        // Для браузера используем MetaMask
        if (typeof window !== 'undefined' && window.ethereum) {
          // Пользователь подписывает транзакцию через MetaMask
          const response = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: { type: 'image', content: imagePreview },
              owner: address
            })
          })
          
          if (response.ok) {
            const result = await response.json()
            metadata.image = result.encryptedURI
          }
        }
      } catch (error) {
        console.error('Image upload error:', error)
        toast({
          title: 'Warning',
          description: 'Failed to upload image, continuing without it',
        })
      }
    }

    // Загружаем метаданные в 0G Storage
    toast({
      title: 'Uploading metadata...',
      description: 'Uploading to 0G Storage',
    })
    
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: metadata,
        owner: address
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to upload metadata')
    }
    
    const { encryptedURI, metadataHash } = await response.json()
    
    toast({
      title: 'Minting NFT...',
      description: 'Please confirm the transaction in your wallet',
    })

    // Минтим INFT
    mintINFT({
      args: [address, encryptedURI, metadataHash],
    })
  } catch (error: any) {
    console.error('Minting error:', error)
    toast({
      title: 'Error',
      description: error.message || 'Failed to mint AI agent',
      variant: 'destructive',
    })
  } finally {
    setIsUploading(false)
  }
}

// Также обновите обработчик успешной транзакции:
const { isLoading: isMinting } = useWaitForTransaction({
  hash: mintData?.hash,
  onSuccess(data) {
    // Извлекаем tokenId из события
    const transferEvent = data.logs.find(
      log => log.topics[0] === ethers.utils.id('Transfer(address,address,uint256)')
    )
    
    if (transferEvent && transferEvent.topics[3]) {
      const tokenId = parseInt(transferEvent.topics[3], 16)
      toast({
        title: 'Success! 🎉',
        description: `Your AI agent #${tokenId} has been minted on 0G Network`,
      })
      
      // Переходим в чат с новым агентом
      setTimeout(() => {
        router.push(`/chat/${tokenId}`)
      }, 2000)
    }
  },
  onError(error) {
    console.error('Transaction error:', error)
    toast({
      title: 'Transaction Failed',
      description: 'The transaction failed. Please try again.',
      variant: 'destructive',
    })
  }
})
    setIsUploading(true)
    try {
      // Prepare agent metadata
      const metadata = {
        name: data.name,
        description: data.description,
        model: data.model,
        capabilities: data.capabilities.split(',').map(c => c.trim()),
        parameters: data.parameters ? JSON.parse(data.parameters) : {},
        image: null as string | null,
        createdAt: Date.now(),
        version: '1.0',
      }

      // Upload image if provided
      if (data.image && imagePreview) {
        // In production, upload to IPFS/0G Storage
        // For now, we'll use the preview
        metadata.image = imagePreview
      }

      // Upload to 0G Storage and get encrypted URI
      const { encryptedURI, metadataHash } = await uploadToStorage(metadata, address)

      // Mint the INFT
      mintINFT({
        args: [address, encryptedURI, metadataHash],
      })
    } catch (error) {
      console.error('Minting error:', error)
      toast({
        title: 'Error',
        description: 'Failed to mint AI agent',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-gray-400">Please connect your wallet to mint an AI agent</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Create AI Agent</h1>
        <p className="text-gray-400">Mint an intelligent NFT with embedded AI capabilities</p>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-400" />
            Agent Configuration
          </CardTitle>
          <CardDescription>Define your AI agent's properties and capabilities</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  placeholder="My AI Assistant"
                  className="bg-gray-900/50 border-gray-600"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-red-400">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">AI Model</Label>
                <Select onValueChange={(value) => setValue('model', value)}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-600">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="claude-3">Claude 3</SelectItem>
                    <SelectItem value="llama-2">Llama 2</SelectItem>
                    <SelectItem value="custom">Custom Model</SelectItem>
                  </SelectContent>
                </Select>
                {errors.model && (
                  <p className="text-sm text-red-400">{errors.model.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what your AI agent can do..."
                className="bg-gray-900/50 border-gray-600 min-h-[100px]"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-red-400">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
              <Input
                id="capabilities"
                placeholder="chat, code generation, image analysis"
                className="bg-gray-900/50 border-gray-600"
                {...register('capabilities')}
              />
              {errors.capabilities && (
                <p className="text-sm text-red-400">{errors.capabilities.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="parameters">Advanced Parameters (JSON)</Label>
              <Textarea
                id="parameters"
                placeholder='{"temperature": 0.7, "max_tokens": 1000}'
                className="bg-gray-900/50 border-gray-600 font-mono text-sm"
                {...register('parameters')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">Agent Avatar (Optional)</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    className="bg-gray-900/50 border-gray-600"
                    onChange={handleImageChange}
                  />
                </div>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-600"
                  />
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isUploading || isMinting}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : isMinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Mint AI Agent
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/agents')}
                className="border-gray-600 hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}