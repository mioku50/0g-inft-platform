// web/app/mint/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { 
  Loader2, 
  Upload, 
  Sparkles, 
  Shield, 
  Zap, 
  Rocket, 
  Star, 
  Wand2,
  GraduationCap,
  BookOpen,
  Brain,
  Code,
  Palette,
  MessageSquare
} from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'
import { ethers } from 'ethers'

const AI_MODELS = [
  { 
    value: 'llama-3.3-70b', 
    label: 'Llama 3.3 70B',
    icon: '🦙',
    description: 'Advanced language understanding'
  },
  { 
    value: 'deepseek-r1-70b', 
    label: 'DeepSeek R1 70B',
    icon: '🔍',
    description: 'Deep reasoning and analysis'
  },
]

const PERSONALITY_TRAITS = [
  { value: 'friendly', label: 'Friendly', emoji: '😊', color: 'from-yellow-400 to-orange-400' },
  { value: 'professional', label: 'Professional', emoji: '💼', color: 'from-blue-400 to-indigo-400' },
  { value: 'creative', label: 'Creative', emoji: '🎨', color: 'from-pink-400 to-purple-400' },
  { value: 'analytical', label: 'Analytical', emoji: '📊', color: 'from-green-400 to-teal-400' },
  { value: 'humorous', label: 'Humorous', emoji: '😄', color: 'from-purple-400 to-pink-400' },
]

const SKILL_BADGES = [
  { id: 'coding', label: 'Coding', icon: Code },
  { id: 'writing', label: 'Writing', icon: BookOpen },
  { id: 'analysis', label: 'Analysis', icon: Brain },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
]

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('llama-3.3-70b')
  const [personality, setPersonality] = useState('friendly')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [expertise, setExpertise] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [step, setStep] = useState(1)
  const [mintStep, setMintStep] = useState<'idle' | 'uploading' | 'minting' | 'success'>('idle')

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImage(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  const generateSystemPrompt = () => {
    const personalityEmoji = PERSONALITY_TRAITS.find(p => p.value === personality)?.emoji || ''
    const basePrompt = `You are ${name}, an AI agent with a ${personality} personality ${personalityEmoji}.`
    const expertisePrompt = expertise ? `\n\nYour areas of expertise include: ${expertise}.` : ''
    const skillsPrompt = selectedSkills.length > 0 
      ? `\n\nYour core skills are: ${selectedSkills.join(', ')}.` 
      : ''
    const customPrompt = systemPrompt ? `\n\n${systemPrompt}` : ''
    
    return basePrompt + expertisePrompt + skillsPrompt + customPrompt
  }

  const handleMint = async () => {
    if (!address || !walletClient || !publicClient) {
      toast({
        title: 'Error',
        description: 'Please connect your wallet',
        variant: 'destructive',
      })
      return
    }

    if (!name || !description) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setMintStep('uploading')
    
    try {
      // Step 1: Prepare metadata
      const finalSystemPrompt = generateSystemPrompt()
      const metadata = {
        name,
        description,
        model,
        personality,
        systemPrompt: finalSystemPrompt,
        expertise: expertise || 'General AI Assistant',
        skills: selectedSkills,
        image: imagePreview || `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`,
        createdAt: new Date().toISOString(),
        creator: address,
      }

      console.log('Metadata:', metadata)

      // Step 2: Upload metadata to 0G Storage
      let metadataHash = ''
      try {
        const uploadResponse = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: JSON.stringify(metadata) }),
        })

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json()
          throw new Error(error.error || 'Failed to upload metadata')
        }

        const uploadResult = await uploadResponse.json()
        metadataHash = uploadResult.rootHash
        console.log('Metadata uploaded:', metadataHash)
      } catch (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error('Failed to upload metadata to storage')
      }

      // Step 3: Mint NFT
      setMintStep('minting')
      
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata)))
      const sealedKey = ethers.keccak256(ethers.toUtf8Bytes('sample-key'))

   console.log('Minting with INFT contract')

const tx = await walletClient.writeContract({
  address: contractAddress,
  abi: INFT_ABI,
  functionName: 'mint',
  args: [
    address,          // to (address)
    metadataHash,     // encryptedURI (string) - это rootHash из 0G Storage
    ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(metadata))) // metadataHash (bytes32)
  ]
})

      console.log('Transaction sent:', tx)

      await publicClient.waitForTransactionReceipt(tx)
      console.log('Transaction confirmed:', receipt)
// Найдите блок после receipt и замените на:

if (receipt.status === 'success') {
  // Получаем tokenId из события
  let tokenId: bigint | undefined
  
  // Ищем событие AgentMinted
  const agentMintedEvent = receipt.logs.find(log => {
    try {
      const decoded = publicClient.decodeEventLog({
        abi: INFT_ABI,
        data: log.data,
        topics: log.topics
      })
      return decoded.eventName === 'AgentMinted'
    } catch {
      return false
    }
  })
  
  if (agentMintedEvent) {
    const decoded = publicClient.decodeEventLog({
      abi: INFT_ABI,
      data: agentMintedEvent.data,
      topics: agentMintedEvent.topics
    })
    tokenId = decoded.args.tokenId
  }
  
  toast({
    title: 'Success!',
    description: `AI Agent "${name}" has been created!${tokenId ? ` Token ID: ${tokenId.toString()}` : ''}`,
  })

  // Reset form
  setName('')
  setDescription('')
  setModel('llama-3.3-70b')
  setPersonality('friendly')
  setSystemPrompt('')
  setExpertise('')
  setImage(null)
  setImagePreview('')

  // Redirect to agents page
  setTimeout(() => {
    router.push('/agents')
  }, 2000)
} else {
  throw new Error('Transaction failed')
}
    
    } catch (error: any) {
      console.error('Mint error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to create AI agent',
        variant: 'destructive',
      })
      setMintStep('idle')
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
            <GraduationCap className="w-16 h-16 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300">Please connect your wallet to enroll a new AI agent</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="container mx-auto py-10 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-white">
                Agent Enrollment Center
              </h1>
            </div>
            <p className="text-xl text-gray-300">
              Welcome to the AI Learning Campus! Let's enroll your new agent student.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${step >= s 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                      : 'bg-gray-700 text-gray-400'
                    }
                  `}>
                    {s}
                  </div>
                  {s < 3 && (
                    <div className={`w-20 h-1 mx-2 ${step > s ? 'bg-purple-500' : 'bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Form Card */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-8">
              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Basic Information</h2>
                    <p className="text-gray-300">Tell us about your new AI agent student</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name" className="text-white">
                        Agent Name <span className="text-red-400">*</span>
                      </Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Professor Panda, Code Sensei"
                        className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400"
                      />
                    </div>

                    <div>
                      <Label htmlFor="model" className="text-white">AI Model</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="mt-2 bg-white/10 border-white/30 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          {AI_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value} className="text-white hover:bg-gray-800">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{m.icon}</span>
                                <div>
                                  <div className="font-medium">{m.label}</div>
                                  <div className="text-xs text-gray-400">{m.description}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-white">
                      Description <span className="text-red-400">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your AI agent's purpose and what makes them special..."
                      className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400"
                      rows={4}
                    />
                  </div>

                  {/* Avatar Upload */}
                  <div>
                    <Label className="text-white mb-3 block">Agent Avatar</Label>
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        {imagePreview ? (
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-32 h-32 rounded-2xl object-cover border-2 border-purple-400"
                          />
                        ) : (
                          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-2 border-dashed border-white/30 flex items-center justify-center">
                            <div className="text-center">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-xs text-gray-400">Upload</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="bg-white/10 border-white/30 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                        />
                        <p className="text-sm text-gray-400 mt-2">
                          A unique avatar will be generated if not provided
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!name || !description}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Next: Personality & Skills
                      <Sparkles className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Personality & Skills */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Personality & Skills</h2>
                    <p className="text-gray-300">Shape your agent's character and abilities</p>
                  </div>

                  {/* Personality Selection */}
                  <div>
                    <Label className="text-white mb-3 block">Choose Personality</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {PERSONALITY_TRAITS.map((trait) => (
                        <button
                          key={trait.value}
                          type="button"
                          onClick={() => setPersonality(trait.value)}
                          className={`
                            relative p-4 rounded-xl border-2 transition-all overflow-hidden
                            ${personality === trait.value 
                              ? 'border-purple-400 bg-purple-600/30' 
                              : 'border-white/20 bg-white/5 hover:bg-white/10'
                            }
                          `}
                        >
                          {personality === trait.value && (
                            <div className={`absolute inset-0 bg-gradient-to-r ${trait.color} opacity-20`} />
                          )}
                          <div className="relative">
                            <div className="text-3xl mb-1">{trait.emoji}</div>
                            <div className="text-sm font-medium text-white">{trait.label}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Skills Selection */}
                  <div>
                    <Label className="text-white mb-3 block">Core Skills</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {SKILL_BADGES.map((skill) => {
                        const Icon = skill.icon
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill.id)}
                            className={`
                              p-4 rounded-xl border-2 transition-all
                              ${selectedSkills.includes(skill.id)
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-400 text-white' 
                                : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                              }
                            `}
                          >
                            <Icon className="h-6 w-6 mx-auto mb-2" />
                            <div className="text-sm font-medium">{skill.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Expertise */}
                  <div>
                    <Label htmlFor="expertise" className="text-white">
                      Areas of Expertise
                    </Label>
                    <Input
                      id="expertise"
                      value={expertise}
                      onChange={(e) => setExpertise(e.target.value)}
                      placeholder="e.g., JavaScript, Creative writing, Data analysis"
                      className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400"
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button
                      onClick={() => setStep(1)}
                      variant="outline"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Next: Custom Instructions
                      <BookOpen className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Final Setup */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Final Setup</h2>
                    <p className="text-gray-300">Add any special instructions for your agent</p>
                  </div>

                  <div>
                    <Label htmlFor="systemPrompt" className="text-white">
                      Custom Instructions (Optional)
                    </Label>
                    <Textarea
                      id="systemPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="Add any specific behaviors, knowledge, or instructions..."
                      className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400"
                      rows={5}
                    />
                    <p className="text-sm text-gray-400 mt-2">
                      These will be added to your agent's core instructions
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="bg-black/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">System Prompt Preview</h3>
                    <p className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                      {generateSystemPrompt()}
                    </p>
                  </div>

                  {/* Summary Card */}
                  <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
                    <CardContent className="p-6">
                      <h4 className="text-xl font-semibold text-white mb-4">Agent Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Name</p>
                          <p className="text-white font-medium">{name}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Model</p>
                          <p className="text-white font-medium">{AI_MODELS.find(m => m.value === model)?.label}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Personality</p>
                          <p className="text-white font-medium">
                            {PERSONALITY_TRAITS.find(p => p.value === personality)?.emoji} {personality}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Skills</p>
                          <p className="text-white font-medium">
                            {selectedSkills.length > 0 ? selectedSkills.join(', ') : 'General'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex justify-between">
                    <Button
                      onClick={() => setStep(2)}
                      variant="outline"
                      className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleMint}
                      disabled={loading}
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {mintStep === 'uploading' && 'Uploading to Campus...'}
                          {mintStep === 'minting' && 'Enrolling Agent...'}
                          {mintStep === 'success' && 'Success! Redirecting...'}
                        </>
                      ) : (
                        <>
                          <GraduationCap className="mr-2 h-5 w-5" />
                          Enroll Agent in Campus
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Minting Status Modal */}
              {mintStep !== 'idle' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                  <Card className="bg-gray-900 border-gray-700 max-w-md w-full mx-4">
                    <CardContent className="p-8 text-center">
                      {mintStep === 'uploading' && (
                        <>
                          <div className="w-20 h-20 mx-auto mb-4 bg-purple-600/20 rounded-full flex items-center justify-center">
                            <Upload className="w-10 h-10 text-purple-400 animate-pulse" />
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Uploading to 0G Storage
                          </h3>
                          <p className="text-gray-400">
                            Securing your agent's data on the blockchain...
                          </p>
                        </>
                      )}
                      
                      {mintStep === 'minting' && (
                        <>
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse">
                            <GraduationCap className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Enrolling in Campus
                          </h3>
                          <p className="text-gray-400">
                            Creating your AI agent NFT...
                          </p>
                        </>
                      )}
                      
                      {mintStep === 'success' && (
                        <>
                          <div className="w-20 h-20 mx-auto mb-4 bg-green-600/20 rounded-full flex items-center justify-center">
                            <Star className="w-10 h-10 text-green-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-white mb-2">
                            Welcome to the Campus!
                          </h3>
                          <p className="text-gray-400 mb-4">
                            {name} has been successfully enrolled
                          </p>
                          <div className="text-6xl mb-4">🐼</div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fun Footer */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-4">
              <div className="text-4xl">🐼</div>
              <p className="text-xl text-gray-300 italic">
                "Every great AI agent starts as a curious student"
              </p>
              <div className="text-4xl">📚</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}