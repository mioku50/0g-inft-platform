'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useContractRead, useNetwork, useSwitchNetwork } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Settings, 
  Share2, 
  ShoppingCart,
  Brain,
  Zap,
  Copy,
  ExternalLink
} from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'
import { computeClient } from '@/lib/compute/client'
import { TransferModal } from '@/components/agent/TransferModal'
import { ListingModal } from '@/components/marketplace/ListingModal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AgentMetadata {
  name: string
  description: string
  model: string
  capabilities: string[]
  image?: string
}

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { switchNetwork, isLoading: isSwitching } = useSwitchNetwork()
  const { openConnectModal } = useConnectModal()
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  const tokenId = params.tokenId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [showListingModal, setShowListingModal] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)

  // Read contract data
  const { data: owner } = useContractRead({
    address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: INFT_ABI,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
  })

  const { data: encryptedURI } = useContractRead({
    address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: INFT_ABI,
    functionName: 'getEncryptedURI',
    args: [BigInt(tokenId)],
  })

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase()

  // Load agent metadata
  useEffect(() => {
    const loadMetadata = async () => {
      if (!encryptedURI || !address) return
      
      try {
        // In production, decrypt metadata from 0G Storage
        // For demo, use mock data
        setAgentMetadata({
          name: `AI Agent #${tokenId}`,
          description: 'An intelligent AI assistant powered by 0G Network',
          model: 'GPT-4',
          capabilities: ['chat', 'code generation', 'analysis'],
          image: `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenId}`
        })
      } catch (error) {
        console.error('Failed to load metadata:', error)
      }
    }

    loadMetadata()
  }, [encryptedURI, address, tokenId])

  // Load chat history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem(`chat-${tokenId}`)
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
  }, [tokenId])

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat-${tokenId}`, JSON.stringify(messages))
    }
  }, [messages, tokenId])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const isCorrectChain = chain?.id === 16601
    if (!isOwner || !isCorrectChain) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)

    try {
      // Call 0G Compute API
      const response = await (computeClient as any).chat({
        tokenId,
        messages: [...messages, userMessage].map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      })

      // Handle streaming response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])

      // Simulate streaming (in production, use actual stream)
      const fullResponse = response.content
      for (let i = 0; i < fullResponse.length; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 50))
        setMessages(prev => {
          const newMessages = [...prev]
          const lastMessage = newMessages[newMessages.length - 1]
          lastMessage.content = fullResponse.slice(0, i + 5)
          return newMessages
        })
      }
    } catch (error) {
      console.error('Chat error:', error)
      toast({
        title: 'Error',
        description: 'Failed to get response from agent',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const copyTokenId = () => {
    navigator.clipboard.writeText(tokenId)
    toast({
      title: 'Copied!',
      description: 'Token ID copied to clipboard',
    })
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-gray-400">Please connect your wallet to chat with this agent</p>
        <div className="mt-4">
          <Button onClick={() => openConnectModal?.()}>Connect</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-800 bg-gray-900/50 p-6">
        <div className="space-y-6">
          {/* Agent Info */}
          <div className="text-center">
            <Avatar className="w-24 h-24 mx-auto mb-4">
              <AvatarImage src={agentMetadata?.image} />
              <AvatarFallback>
                <Bot className="w-12 h-12" />
              </AvatarFallback>
            </Avatar>
            <h2 className="text-xl font-bold text-white mb-1">
              {agentMetadata?.name || `Agent #${tokenId}`}
            </h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs">
                {agentMetadata?.model || 'Loading...'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyTokenId}
                className="h-6 px-2"
              >
                <Copy className="w-3 h-3 mr-1" />
                #{tokenId}
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {agentMetadata?.description}
            </p>
          </div>

          <Separator className="bg-gray-800" />

          {/* Capabilities */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Capabilities
            </h3>
            <div className="flex flex-wrap gap-2">
              {agentMetadata?.capabilities.map((cap, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          <Separator className="bg-gray-800" />

          {/* Actions */}
          <div className="space-y-2">
            {isOwner ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowTransferModal(true)}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Transfer Agent
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowListingModal(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  List on Marketplace
                </Button>
              </>
            ) : (
              <div className="text-sm text-gray-400 text-center">
                Owned by: {owner?.slice(0, 6)}...{owner?.slice(-4)}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => window.open(`https://explorer-testnet.0g.ai/token/${process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS}/instance/${tokenId}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Explorer
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500">
                Ask your AI agent anything or give it a task
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={agentMetadata?.image} />
                      <AvatarFallback>
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  {message.role === 'user' && (
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isStreaming && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={agentMetadata?.image} />
                    <AvatarFallback>
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-800 rounded-lg px-4 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading || !isOwner || chain?.id !== 16601}
              className="bg-gray-900/50 border-gray-700"
            />
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !isOwner || chain?.id !== 16601}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {!isOwner && (
            <div className="text-sm text-yellow-400 mt-2">
              Подключите кошелёк владельца агента №{tokenId} (сеть Galileo 16601)
            </div>
          )}
          {isOwner && chain?.id !== 16601 && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 mt-2">
              <span>Переключитесь на сеть Galileo 16601</span>
              <Button size="sm" variant="outline" onClick={() => switchNetwork?.(16601)} disabled={isSwitching}>
                {isSwitching ? 'Switching…' : 'Switch network'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTransferModal && (
        <TransferModal
          tokenId={tokenId}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false)
            router.push('/agents')
          }}
        />
      )}

      {showListingModal && (
        <ListingModal
          tokenId={tokenId}
          agentName={agentMetadata?.name || `Agent #${tokenId}`}
          onClose={() => setShowListingModal(false)}
          onSuccess={() => {
            setShowListingModal(false)
            toast({
              title: 'Success!',
              description: 'Your agent has been listed on the marketplace',
            })
          }}
        />
      )}
    </div>
  )
}