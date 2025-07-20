// web/app/mint/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { Label } from '@/components/ui'
import { Textarea } from '@/components/ui'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { Card, CardContent } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Alert, AlertDescription } from '@/components/ui'
import { toast } from '@/components/ui'
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

  const contractAddress = (process.env?.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS ?? '') as `0x${string}`

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  setImage(file)
  
  // Для маленьких файлов используем base64
  if (file.size < 100 * 1024) { // < 100KB
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  } else {
    // Для больших файлов используем placeholder
    setImagePreview(`https://api.dicebear.com/7.x/bottts/svg?seed=${name || 'agent'}`)
  }
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
    const personalityLabel = PERSONALITY_TRAITS.find(p => p.value === personality)?.label || personality
    
    // Базовый промпт
    let prompt = `You are ${name}, an AI agent with a ${personalityLabel} personality ${personalityEmoji}.`
    
    // Добавляем описание личности
    switch (personality) {
      case 'friendly':
        prompt += '\n\nYou are warm, approachable, and always eager to help with a positive attitude.'
        break
      case 'professional':
        prompt += '\n\nYou maintain a professional demeanor, providing clear and concise information.'
        break
      case 'creative':
        prompt += '\n\nYou think outside the box and approach problems with innovative solutions.'
        break
      case 'analytical':
        prompt += '\n\nYou excel at breaking down complex problems and providing data-driven insights.'
        break
      case 'humorous':
        prompt += '\n\nYou have a great sense of humor and enjoy making interactions fun and engaging.'
        break
    }
    
    // Добавляем экспертизу
    if (expertise) {
      prompt += `\n\nYour areas of expertise include: ${expertise}.`
    }
    
    // Добавляем навыки
    if (selectedSkills.length > 0) {
      const skillDescriptions = selectedSkills.map(skill => {
        switch(skill) {
          case 'coding': return 'programming and software development'
          case 'writing': return 'creative and technical writing'
          case 'analysis': return 'data analysis and problem solving'
          case 'design': return 'visual and UX/UI design'
          case 'chat': return 'conversational AI and dialogue'
          default: return skill
        }
      })
      prompt += `\n\nYour specialized skills include: ${skillDescriptions.join(', ')}.`
    }
    
    // Добавляем кастомные инструкции ТОЛЬКО если это обычный текст
    if (systemPrompt) {
      // Очищаем от JSON и странных символов
      const cleanedPrompt = systemPrompt
        .replace(/[{}\[\]"]/g, '') // Удаляем JSON символы
        .replace(/\\n/g, '\n')      // Заменяем экранированные переносы
        .replace(/\s+/g, ' ')       // Нормализуем пробелы
        .trim()
      
      // Добавляем только если это выглядит как обычный текст
      if (cleanedPrompt && !cleanedPrompt.includes('"role"') && !cleanedPrompt.includes('"personality"')) {
        prompt += `\n\n${cleanedPrompt}`
      }
    }
    
    // Добавляем стандартные инструкции
    prompt += '\n\nAlways be helpful, truthful, and respectful in your responses. Engage naturally in conversation while leveraging your unique personality and skills.'
    
    return prompt
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
      // Step 1: Prepare clean metadata
      const finalSystemPrompt = generateSystemPrompt()
      
      // Создаем чистую структуру метаданных
      const metadata = {
        // Основные поля
        name: name.trim(),
        description: description.trim(),
        model: model,
        personality: personality,
        
        // Системный промпт - ТОЛЬКО текст, без JSON
        systemPrompt: finalSystemPrompt,
        
        // Дополнительные поля
        expertise: expertise.trim() || 'General AI Assistant',
        skills: selectedSkills,
        
        // Изображение
        image: imagePreview || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
        
        // Метаинформация
        createdAt: new Date().toISOString(),
        creator: address,
        version: '1.0',
        
        // Флаг что это оригинал, не клон
        isClone: false
      }

      console.log('Clean metadata structure:', {
        ...metadata,
        systemPrompt: metadata.systemPrompt.substring(0, 100) + '...' // Логируем только начало
      })

      // Step 2: Upload metadata to storage
      let metadataHash = ''
      try {
        const uploadResponse = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            metadata: metadata // Отправляем чистые метаданные
          }),
        })

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json()
          console.error('Upload response error:', error)
          throw new Error(error.error || 'Failed to upload metadata')
        }

        const uploadResult = await uploadResponse.json()
        metadataHash = uploadResult.rootHash
        console.log('Metadata uploaded successfully:', {
          rootHash: metadataHash,
          local: uploadResult.local || false
        })
        
        // Ждем синхронизации
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (uploadError: any) {
        console.error('Upload error:', uploadError)
        
        // Если upload failed, создаем hash локально
        metadataHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(metadata))
        )
        
        console.log('Using local hash fallback:', metadataHash)
      }

      // Step 3: Mint NFT
      setMintStep('minting')
      
      // Создаем hash для контракта (это другой hash, не путать с rootHash)
      const contractMetadataHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify({
          name: metadata.name,
          model: metadata.model,
          creator: metadata.creator
        }))
      )
      
      console.log('Minting with params:', {
        to: address,
        encryptedURI: metadataHash,
        metadataHash: contractMetadataHash
      })

      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'mint',
        args: [
          address as `0x${string}`,
          metadataHash as `0x${string}`,
          contractMetadataHash as `0x${string}`
        ]
      })

      console.log('Transaction sent:', tx)

      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      console.log('Transaction confirmed:', receipt)

      if (receipt.status === 'success') {
        setMintStep('success')
        
        // Получаем tokenId из события
        let tokenId: string | undefined
        
        const transferEvent = receipt.logs.find(log => {
          try {
            const decoded = (publicClient as any).decodeEventLog({
              abi: INFT_ABI,
              data: log.data,
              topics: log.topics as any
            })
            return decoded.eventName === 'Transfer' && 
                   decoded.args.from === '0x0000000000000000000000000000000000000000'
          } catch {
            return false
          }
        })
        
        if (transferEvent) {
          const decoded = (publicClient as any).decodeEventLog({
            abi: INFT_ABI,
            data: transferEvent.data,
            topics: transferEvent.topics as any
          })
          tokenId = decoded.args.tokenId?.toString()
        }
        
        toast({
          title: 'Success! 🎉',
          description: `AI Agent "${name}" has been created!${tokenId ? ` Token ID: ${tokenId}` : ''}`,
        })

        // Сброс формы
        setTimeout(() => {
          setName('')
          setDescription('')
          setModel('llama-3.3-70b')
          setPersonality('friendly')
          setSystemPrompt('')
          setExpertise('')
          setSelectedSkills([])
          setImage(null)
          setImagePreview('')
          setStep(1)
          
          router.push('/agents')
        }, 2000)
      } else {
        throw new Error('Transaction failed')
      }
      
    } catch (error: any) {
      console.error('Mint error:', error)
      
      let errorMessage = 'Failed to create AI agent'
      
      if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled'
      } else if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas fees'
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
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
                      onChange={(e) => {
                        const value = e.target.value
                        
                        // Предупреждаем если пользователь пытается ввести JSON
                        if (value.includes('{') || value.includes('[') || value.includes('"role"')) {
                          toast({
                            title: 'Plain Text Only',
                            description: 'Please enter instructions in plain text, not JSON or code format.',
                            variant: 'destructive'
                          })
                          return
                        }
                        
                        setSystemPrompt(value)
                      }}
                      placeholder="Example: Always be polite and helpful. Focus on providing detailed explanations. Use examples when explaining complex topics."
                      className="mt-2 bg-white/10 border-white/30 text-white placeholder:text-gray-400 font-sans"
                      rows={5}
                    />
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-400">
                        ✅ Good examples:
                      </p>
                      <ul className="text-xs text-gray-500 list-disc list-inside space-y-1">
                        <li>"Always explain your reasoning step by step"</li>
                        <li>"Be encouraging and supportive when helping users learn"</li>
                        <li>"Use simple language and avoid technical jargon"</li>
                      </ul>
                      <p className="text-sm text-red-400 mt-2">
                        ❌ Don't use JSON, code blocks, or special formatting
                      </p>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-black/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-purple-400" />
                      System Prompt Preview
                    </h3>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                      <p className="text-gray-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {generateSystemPrompt()}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      This is how your agent will understand its role and behavior
                    </p>
                  </div>

                  {/* Summary Card */}
                  <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30">
                    <CardContent className="p-6">
                      <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-400" />
                        Agent Summary
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Name</p>
                          <p className="text-white font-medium">{name || 'Not set'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Model</p>
                          <p className="text-white font-medium flex items-center gap-1">
                            {AI_MODELS.find(m => m.value === model)?.icon}
                            {AI_MODELS.find(m => m.value === model)?.label}
                          </p>
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
                            {selectedSkills.length > 0 ? (
                              <span className="flex flex-wrap gap-1">
                                {selectedSkills.map(skill => (
                                  <Badge key={skill} variant="secondary" className="text-xs bg-white/20 border-0">
                                    {skill}
                                  </Badge>
                                ))}
                              </span>
                            ) : (
                              'General Assistant'
                            )}
                          </p>
                        </div>
                      </div>
                      
                      {expertise && (
                        <div className="mt-4 pt-4 border-t border-purple-500/20">
                          <p className="text-gray-400 text-sm">Areas of Expertise</p>
                          <p className="text-white font-medium text-sm mt-1">{expertise}</p>
                        </div>
                      )}
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
                      disabled={loading || !name || !description}
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 min-w-[200px]"
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