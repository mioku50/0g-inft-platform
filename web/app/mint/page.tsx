// app/mint/page.tsx
'use client'

import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Upload, Sparkles, Shield, Zap, Rocket, Star, Wand2 } from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'
import { ethers } from 'ethers'
import { uploadMetadata } from '@/lib/storage/client-browser'

const { rootHash, txHash } = await uploadMetadata(metadata)
const ERC7857_MINT_ABI = [
  
  {
    "inputs": [
      { "internalType": "address", "name": "_to", "type": "address" },
      { "internalType": "string", "name": "_dataUri", "type": "string" },
      { "internalType": "bool", "name": "_isDataPublic", "type": "bool" }
    ],
    "name": "mint",
    "outputs": [
      { "internalType": "uint256", "name": "_tokenId", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const

const AI_MODELS = [
  { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
  { value: 'deepseek-r1-70b', label: 'DeepSeek R1 70B' },
]

const PERSONALITY_TRAITS = [
  { value: 'friendly', label: 'Friendly', emoji: '😊' },
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'creative', label: 'Creative', emoji: '🎨' },
  { value: 'analytical', label: 'Analytical', emoji: '📊' },
  { value: 'humorous', label: 'Humorous', emoji: '😄' },
]

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingMetadata, setUploadingMetadata] = useState(false)
  const [error, setError] = useState('')
  
  const [useERC7857, setUseERC7857] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('llama-3.3-70b')
  const [personality, setPersonality] = useState('creative')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')

  const oldContractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`
  const erc7857ContractAddress = '0x027eFE8FE350b1CAed2cca7a662EBF4520C237E2' as `0x${string}`

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMint = async () => {
  if (!walletClient || !address || !publicClient) return

  try {
    setLoading(true)
    setError('')
    
    let imageUrl = ''
    if (imageFile) {
      setUploadingImage(true)
      const formData = new FormData()
      formData.append('file', imageFile)
      
      try {
        const imageResponse = await fetch('/api/storage/upload-image', {
          method: 'POST',
          body: formData,
        })
        
        if (imageResponse.ok) {
          const { url } = await imageResponse.json()
          imageUrl = url
        }
      } catch (err) {
        console.log('Image upload failed, using default avatar')
      }
      setUploadingImage(false)
    }

    const defaultPrompt = systemPrompt || `You are ${agentName}, a ${personality} AI assistant.`
    const metadata = {
      name: agentName,
      description: description || agentName,
      image: imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`,
      model,
      personality,
      systemPrompt: defaultPrompt,
      createdAt: new Date().toISOString(),
      createdBy: address
    }

    console.log('Minting with metadata:', metadata)

    setUploadingMetadata(true)
    const metadataResponse = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        metadata: metadata
      }),
    })

    const responseText = await metadataResponse.text()
    console.log('Metadata upload response:', responseText)

    if (!metadataResponse.ok) {
      throw new Error(`Failed to upload metadata: ${responseText}`)
    }

    const uploadResult = JSON.parse(responseText)
    const rootHash = uploadResult.rootHash
    
    if (!rootHash) {
      throw new Error('No root hash received from storage')
    }
    
    console.log('Metadata uploaded, rootHash:', rootHash)
    console.log('rootHash type:', typeof rootHash)
    console.log('rootHash length:', rootHash.length)
    setUploadingMetadata(false)

    let tx
    if (useERC7857) {
      console.log('Minting with ERC7857...')
      tx = await walletClient.writeContract({
        address: erc7857ContractAddress,
        abi: ERC7857_MINT_ABI,
        functionName: 'mint',
        args: [address, rootHash, true]
      })
    } else {
      console.log('Minting with INFT contract...')
      
      // Убедимся, что rootHash это строка
      const rootHashString = rootHash.toString()
      
      // Создаем bytes32 хеш правильно
      const metadataHashBytes32 = ethers.keccak256(
        ethers.toUtf8Bytes(rootHashString)
      ) as `0x${string}`
      
      console.log('Mint parameters:', {
        to: address,
        encryptedURI: rootHashString,
        metadataHash: metadataHashBytes32
      })
      
      tx = await walletClient.writeContract({
        address: oldContractAddress,
        abi: INFT_ABI,
        functionName: 'mint',
        args: [
          address as `0x${string}`,
          rootHashString,
          metadataHashBytes32
        ]
      })
    }

    await publicClient.waitForTransactionReceipt({ hash: tx })

    toast({
      title: 'Success!',
      description: `AI Agent "${agentName}" minted successfully!`
    })

    router.push('/agents')
  } catch (error: any) {
    console.error('Mint error:', error)
    setError(error.shortMessage || error.message || 'Failed to mint agent')
    toast({
      title: 'Error',
      description: error.shortMessage || error.message || 'Failed to mint agent',
      variant: 'destructive'
    })
  } finally {
    setLoading(false)
    setUploadingImage(false)
    setUploadingMetadata(false)
  }
}

  return (
    <div className="min-h-screen relative bg-gray-900">
      {/* Градиентный фон как на главной */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-gray-900 to-gray-900" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl" />
      </div>

      {/* Анимированные элементы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 animate-float">
          <Wand2 className="w-8 h-8 text-purple-400/30" />
        </div>
        <div className="absolute top-40 right-20 animate-float-delayed">
          <Star className="w-6 h-6 text-pink-400/30" />
        </div>
        <div className="absolute bottom-40 left-20 animate-float">
          <Sparkles className="w-10 h-10 text-blue-400/30" />
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-4 text-white">
              Create Your AI Agent
            </h1>
            <p className="text-gray-300 text-lg">
              Mint a unique AI agent NFT powered by 0G Network
            </p>
          </div>

          {/* Contract Selection */}
          <Card className="mb-6 bg-gray-800/50 backdrop-blur border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {useERC7857 ? 'ERC7857 Advanced NFT' : 'Standard INFT'}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {useERC7857 
                      ? 'Enhanced features with encrypted metadata and secure transfers'
                      : 'Classic NFT with standard transfer functionality'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useERC7857}
                    onChange={(e) => setUseERC7857(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-pink-500"></div>
                </label>
              </div>
              {useERC7857 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Encrypted Metadata
                  </span>
                  <span className="px-3 py-1 bg-pink-500/20 text-pink-300 rounded-full text-xs flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Secure Transfers
                  </span>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs flex items-center gap-1">
                    <Rocket className="w-3 h-3" /> Advanced Features
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main Form */}
          <Card className="bg-gray-800/50 backdrop-blur border-purple-500/30">
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name" className="text-white">Agent Name</Label>
                  <Input
                    id="name"
                    placeholder="My AI Assistant"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="bg-gray-700/50 border-gray-600 text-white mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="model" className="text-white">AI Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="bg-gray-700/50 border-gray-600 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {AI_MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-white">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your AI agent..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-gray-700/50 border-gray-600 text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-white mb-3 block">Personality Type</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {PERSONALITY_TRAITS.map((trait) => (
                    <button
                      key={trait.value}
                      type="button"
                      onClick={() => setPersonality(trait.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        personality === trait.value
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-600 bg-gray-700/30 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">{trait.emoji}</div>
                        <div className="text-sm">{trait.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="prompt" className="text-white">System Prompt (Optional)</Label>
                <Textarea
                  id="prompt"
                  placeholder='{"role": "assistant", "knowledge": []}'
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={6}
                  className="bg-gray-700/50 border-gray-600 text-white mt-2 font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="image" className="text-white">Agent Avatar (Optional)</Label>
                <div className="mt-2 flex items-center gap-4">
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-20 h-20 rounded-lg object-cover border-2 border-purple-500"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-700/50 border-2 border-dashed border-gray-600 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="bg-gray-700/50 border-gray-600 text-white file:bg-gray-700 file:text-white file:border-0"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-300 text-sm">Error</p>
                  <p className="text-white">{error}</p>
                </div>
              )}

              <Button
                onClick={handleMint}
                disabled={loading || !agentName || !isConnected}
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {uploadingImage ? 'Uploading Image...' : uploadingMetadata ? 'Uploading Metadata...' : 'Minting...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Mint AI Agent
                  </>
                )}
              </Button>

              {!isConnected && (
                <p className="text-center text-sm text-gray-400">
                  Please connect your wallet to mint an agent
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 6s ease-in-out infinite;
          animation-delay: 3s;
        }
      `}</style>
    </div>
  )
}