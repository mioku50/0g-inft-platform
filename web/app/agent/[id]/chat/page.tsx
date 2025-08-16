'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { INFT_ABI } from '@/lib/contracts/abis'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Settings, 
  Bot, 
  User, 
  Activity,
  Clock,
  DollarSign,
  Network
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AgentMetadata {
  name: string
  description: string
  image?: string
  model?: string
  personality?: string
  systemPrompt?: string
}

export default function ChatPage() {
  const params = useParams()
  const tokenId = params.id as string
  const { address } = useAccount()
  const publicClient = usePublicClient()
  
  const [agent, setAgent] = useState<{ tokenId: string; metadata: AgentMetadata } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [providerInfo, setProviderInfo] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!publicClient || !tokenId) return

    const loadAgent = async () => {
      try {
        // Load metadata hash
        let metadataHash = ''
        try {
          metadataHash = await publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'getEncryptedURI',
            args: [BigInt(tokenId)],
          }) as string
        } catch (e) {
          console.warn('getEncryptedURI failed, trying getMetadataHash')
          try {
            metadataHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getMetadataHash',
              args: [BigInt(tokenId)],
            }) as string
          } catch (e2) {
            console.error('Both methods failed:', e2)
          }
        }

        if (metadataHash && metadataHash !== '0x' && metadataHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          try {
            const response = await fetch('/api/storage/retrieve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                rootHash: metadataHash,
                tokenId: tokenId
              }),
            })
            
            if (response.ok) {
              const data = await response.json()
              const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
              
              setAgent({ tokenId, metadata })
              
              // Welcome message
              const welcomeMessage = metadata.systemPrompt 
                ? `Hello! ${metadata.systemPrompt.split('.')[0]}.` 
                : `Hello! I'm ${metadata.name}. ${metadata.description || 'How can I help you today?'}`
              
              setMessages([{
                id: '1',
                role: 'assistant',
                content: welcomeMessage,
                timestamp: new Date()
              }])
            } else {
              throw new Error('Failed to retrieve metadata')
            }
          } catch (error) {
            console.error('Failed to load metadata:', error)
            // Set fallback metadata
            setAgent({
              tokenId,
              metadata: {
                name: `AI Agent #${tokenId}`,
                description: 'An intelligent AI assistant ready to help you.',
                model: 'llama-3.3-70b-instruct'
              }
            })
            
            setMessages([{
              id: '1',
              role: 'assistant',
              content: `Hello! I'm AI Agent #${tokenId}. How can I assist you today?`,
              timestamp: new Date()
            }])
          }
        } else {
          // Fallback for tokens without metadata
          setAgent({
            tokenId,
            metadata: {
              name: `AI Agent #${tokenId}`,
              description: 'An intelligent AI assistant ready to help you.',
              model: 'llama-3.3-70b-instruct'
            }
          })
          
          setMessages([{
            id: '1',
            role: 'assistant',
            content: `Hello! I'm AI Agent #${tokenId}. How can I assist you today?`,
            timestamp: new Date()
          }])
        }
      } catch (error) {
        console.error('Error loading agent:', error)
      } finally {
        setInitializing(false)
      }
    }

    loadAgent()
  }, [publicClient, tokenId, contractAddress])

  const sendMessage = async () => {
    if (!input.trim() || loading || !agent) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          agentMetadata: agent.metadata
        }),
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
        
        // Update provider info for debug panel
        if (data.provider) {
          setProviderInfo({
            provider: data.provider,
            model: data.model,
            ttfb: data.metadata?.timing?.totalTTFB,
            isRealAI: data.isRealAI
          })
        }
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-0g-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-0g-400 mx-auto mb-4"></div>
          <p className="text-0g-200">Connecting to Agent #{tokenId}...</p>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-0g-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Unable to load agent details</p>
          <Link href="/agents">
            <Button className="mt-4 bg-0g-600 hover:bg-0g-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Agents
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-0g-950 via-purple-950 to-indigo-950 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-0g-500/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/agents">
                <Button variant="ghost" size="sm" className="text-0g-200 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-0g-500 to-purple-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-semibold">{agent.metadata.name}</h1>
                  <p className="text-0g-300 text-sm">{agent.metadata.model || 'AI Assistant'}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-500/20 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-xs">Connected</span>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSettings(!showSettings)}
                className="text-0g-200 hover:text-white hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Debug Panel */}
      {showSettings && providerInfo && (
        <div className="relative z-10 bg-black/40 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Network className="w-4 h-4 text-0g-400" />
                <span className="text-0g-300">Provider:</span>
                <span className="text-white font-mono text-xs">{providerInfo.provider?.slice(0, 10)}...</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-0g-400" />
                <span className="text-0g-300">TTFB:</span>
                <span className="text-white">{providerInfo.ttfb || 0}ms</span>
              </div>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-0g-400" />
                <span className="text-0g-300">Status:</span>
                <span className={`${providerInfo.isRealAI ? 'text-green-400' : 'text-yellow-400'}`}>
                  {providerInfo.isRealAI ? 'Real AI' : 'Fallback'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Bot className="w-4 h-4 text-0g-400" />
                <span className="text-0g-300">Model:</span>
                <span className="text-white">{providerInfo.model}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <main className="relative z-10 flex-1 overflow-hidden">
        <div className="h-[calc(100vh-200px)] overflow-y-auto px-4 py-6">
          <div className="container mx-auto max-w-4xl space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                      : 'bg-gradient-to-r from-0g-500 to-purple-500'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                      : 'bg-white/10 backdrop-blur-xl border border-white/20 text-white'
                  }`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-0g-500 to-purple-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-0g-400" />
                      <span className="text-0g-300">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Input Area */}
      <footer className="relative z-10 bg-black/20 backdrop-blur-xl border-t border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-end space-x-4">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type your message..."
                disabled={loading}
                className="min-h-[60px] bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder-white/50 resize-none focus:ring-2 focus:ring-0g-500 focus:border-transparent"
              />
            </div>
            
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-0g-600 to-purple-600 hover:from-0g-700 hover:to-purple-700 text-white h-[60px] px-6 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-0g-500/25"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}