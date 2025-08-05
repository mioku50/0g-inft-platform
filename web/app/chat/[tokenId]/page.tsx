'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useContractRead } from 'wagmi'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
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
  ExternalLink,
  ArrowLeft
} from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'
import { useNonCustodialChat } from '@/hooks/useNonCustodialChat'
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

  // Non-custodial chat hook
  const { sendMessage: sendNonCustodialMessage, loading: chatLoading, error: chatError } = useNonCustodialChat()

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
    if (!input.trim() || isLoading || chatLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input
    setInput('')
    setIsLoading(true)
    setIsStreaming(true)

    try {
      console.log('[Chat] Using non-custodial mode')
      
      // Use non-custodial chat
      const result = await sendNonCustodialMessage(
        currentInput,
        {
          name: agentMetadata?.name || `Agent #${tokenId}`,
          description: agentMetadata?.description || 'An intelligent AI assistant powered by 0G Network'
        },
        {
          providerAddress: process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
        }
      )

      if (result && result.content) {
        // Create assistant message
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.content,
          timestamp: new Date(),
        }

        setMessages(prev => [...prev, assistantMessage])

        // Show success toast with metadata
        toast({
          title: `Response from ${result.model || 'AI'}`,
          description: `✅ Real AI: ${result.isRealAI ? 'Yes' : 'No'} | Provider: ${result.provider ? result.provider.slice(0, 8) + '...' : 'Unknown'}`,
        })
      } else {
        throw new Error('No response content received')
      }
    } catch (error: any) {
      console.error('[Chat] Non-custodial error:', error)
      
      // Create error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I'm having trouble connecting to the 0G Compute Network. 

🔧 **Error Details:**
${error.message}

💡 **Troubleshooting:**
- Make sure your wallet is connected
- Ensure you have sufficient OG balance for compute fees
- Check that you're on Galileo Testnet v3 (Chain ID: 16601)

I'll be ready to help once the connection is restored!`,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, errorMessage])

      toast({
        title: 'Connection Error',
        description: 'Failed to get response from 0G Compute Network',
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend()
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Connect Your Wallet</h2>
            <p className="text-purple-200 text-center mb-6">
              Please connect your wallet to chat with your AI agents
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 bg-white/10 backdrop-blur-sm border-r border-white/20 p-6">
          <div className="space-y-6">
            {/* Agent Info */}
            <div className="text-center">
              <Avatar className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400">
                <AvatarImage src={agentMetadata?.image} />
                <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                  <Bot className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-white mb-1">
                {agentMetadata?.name || `Agent #${tokenId}`}
              </h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Badge className="bg-purple-600 text-white text-xs">
                  <Brain className="w-3 h-3 mr-1" />
                  {agentMetadata?.model || 'Loading...'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTokenId}
                  className="h-6 px-2 text-white/80 hover:text-white hover:bg-white/10"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  #{tokenId}
                </Button>
              </div>
              <p className="text-sm text-purple-200 mb-4">
                {agentMetadata?.description}
              </p>
            </div>

            <Separator className="bg-white/20" />

            {/* Capabilities */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {agentMetadata?.capabilities?.map((cap, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-white/30 text-white">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator className="bg-white/20" />

            {/* Actions */}
            <div className="space-y-2">
              {isOwner ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/30 text-white hover:bg-white/10"
                    onClick={() => setShowTransferModal(true)}
                  >
                    <Share2 className="w-4 w-4 mr-2" />
                    Transfer Agent
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-white/30 text-white hover:bg-white/10"
                    onClick={() => setShowListingModal(true)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    List on Marketplace
                  </Button>
                </>
              ) : (
                <div className="text-sm text-purple-200 text-center p-2 bg-white/5 rounded-lg">
                  Owned by: {owner?.slice(0, 6)}...{owner?.slice(-4)}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full justify-start border-white/30 text-white hover:bg-white/10"
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
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                  <Brain className="w-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Start a conversation
                </h3>
                <p className="text-purple-200">
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
                      <Avatar className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400">
                        <AvatarImage src={agentMetadata?.image} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                          <Bot className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/20 text-white border border-white/20 backdrop-blur-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {message.role === 'user' && (
                      <Avatar className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-400">
                        <AvatarFallback className="bg-gradient-to-br from-blue-400 to-cyan-400 text-white">
                          <User className="w-4 h-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isStreaming && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400">
                      <AvatarImage src={agentMetadata?.image} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-white/20 border border-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
                        <span className="text-purple-200 text-sm">
                          {agentMetadata?.name} is thinking...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-white/20 p-4 bg-white/5 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Input
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || chatLoading}
                className="bg-white/10 border-white/30 text-white placeholder:text-purple-300 focus:border-purple-400"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || chatLoading || !input.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              >
                {(isLoading || chatLoading) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
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