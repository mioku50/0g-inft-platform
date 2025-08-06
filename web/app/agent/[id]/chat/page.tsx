'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INFT_ABI } from '@/lib/contracts/abis'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { LedgerBalance } from '@/components/compute/LedgerBalance'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function ChatPage() {
  const params = useParams()
  const tokenId = params.id as string
  const { address } = useAccount()
  const publicClient = usePublicClient()
  
  const [agent, setAgent] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!publicClient || !tokenId) return

    const loadAgent = async () => {
      try {
        // ВАЖНО: Используем getEncryptedURI вместо getMetadataHash
        let metadataHash = ''
        try {
          // Сначала пробуем getEncryptedURI (это правильный метод)
          metadataHash = await publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'getEncryptedURI',
            args: [BigInt(tokenId)],
          }) as string
        } catch (e) {
          console.warn('getEncryptedURI failed, trying getMetadataHash')
          // Fallback на getMetadataHash если getEncryptedURI не работает
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

        console.log('Loading metadata for token', tokenId, 'hash:', metadataHash)

        if (metadataHash && metadataHash !== '0x' && metadataHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          try {
            const response = await fetch('/api/storage/retrieve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                rootHash: metadataHash,
                tokenId: tokenId // Передаем tokenId для fallback
              }),
            })
            
            if (response.ok) {
              const data = await response.json()
              const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
              
              console.log('Loaded metadata:', metadata)
              
              setAgent({ tokenId, metadata })
              
              // Создаем приветственное сообщение
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
            // Используем fallback данные
            const fallbackMetadata = {
              name: `Agent #${tokenId}`,
              description: 'AI Assistant',
              model: 'llama-3.3-70b',
              personality: 'friendly'
            }
            setAgent({ tokenId, metadata: fallbackMetadata })
            setMessages([{
              id: '1',
              role: 'assistant',
              content: `Hello! I'm Agent #${tokenId}. How can I help you today?`,
              timestamp: new Date()
            }])
          }
        } else {
          // Нет метаданных - используем дефолтные
          const fallbackMetadata = {
            name: `Agent #${tokenId}`,
            description: 'AI Assistant',
            model: 'llama-3.3-70b',
            personality: 'friendly'
          }
          setAgent({ tokenId, metadata: fallbackMetadata })
          setMessages([{
            id: '1',
            role: 'assistant',
            content: `Hello! I'm Agent #${tokenId}. How can I help you today?`,
            timestamp: new Date()
          }])
        }
      } catch (error) {
        console.error('Error loading agent:', error)
        // Даже при ошибке показываем что-то
        setAgent({ 
          tokenId, 
          metadata: { 
            name: `Agent #${tokenId}`, 
            model: 'llama-3.3-70b' 
          } 
        })
        setMessages([{
          id: '1',
          role: 'assistant',
          content: `Hello! I'm Agent #${tokenId}. How can I assist you?`,
          timestamp: new Date()
        }])
      } finally {
        setInitializing(false)
      }
    }

    loadAgent()
  }, [publicClient, tokenId, contractAddress])

  const sendMessage = async () => {
    if (!input.trim() || loading) return

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
      console.log('[Chat] Checking for non-custodial mode...')
      
      // Check if non-custodial mode is enabled and wallet is connected
      const useNonCustodial = process.env.NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE === 'true'
      
      if (useNonCustodial && address) {
        console.log('[Chat] Using non-custodial mode with wallet:', address)
        
        // Import and use non-custodial chat
        const { ensureLedger, prepareComputeRequest, isClientBrokerAvailable } = await import('@/lib/compute/clientBroker')
        
        const walletAvailable = await isClientBrokerAvailable()
        if (!walletAvailable) {
          throw new Error('Wallet not connected. Please connect your wallet to use AI chat.')
        }

        // Ensure ledger exists
        await ensureLedger()

        // Prepare the request
        const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
        const payload = {
          messages: [
            {
              role: 'system',
              content: `You are ${agent?.metadata?.name || 'AI Assistant'}. ${agent?.metadata?.description || 'You are helpful and friendly.'}`
            },
            {
              role: 'user',
              content: userMessage.content
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        }

        const preparedRequest = await prepareComputeRequest(providerAddress, payload)

        // Send prepared request
        const response = await fetch('/api/compute/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            agentMetadata: agent?.metadata,
            providerAddress,
            prepared: true,
            prep: preparedRequest
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || `HTTP ${response.status}`)
        }

        // Handle different response types
        const contentType = response.headers.get('content-type')
        let responseContent = ''
        
        if (contentType?.includes('application/json')) {
          const data = await response.json()
          if (data.choices && data.choices[0]) {
            responseContent = data.choices[0].message.content
          } else if (data.success && data.response) {
            responseContent = data.response
          } else {
            throw new Error('Unexpected response format')
          }
        } else {
          responseContent = await response.text()
        }

        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: responseContent,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
        
      } else {
        // Fallback to custodial mode
        console.log('[Chat] Using custodial mode fallback...')
        
        const response = await fetch('/api/compute/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            agentMetadata: agent?.metadata,
            providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment before sending another message.')
          } else if (response.status === 504) {
            throw new Error('Request timeout. The 0G network might be busy. Please try again.')
          } else {
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
          }
        }

        const data = await response.json()
        
        console.log('[Chat] Response received:', {
          success: data.success,
          isRealAI: data.isRealAI,
          model: data.model,
          cached: data.metadata?.cached
        })
        
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
      }
      
    } catch (error: any) {
      console.error('Chat error:', error)
      
      let errorMessage = 'Sorry, I encountered an error. Please try again.'
      
      if (error.message.includes('Wallet not connected')) {
        errorMessage = '🔗 **Wallet Connection Required**\n\nTo use AI chat, please connect your wallet. This enables secure, non-custodial payments to the 0G Compute Network.\n\n[Connect your wallet using the button in the top right corner]'
      } else if (error.message.includes('rate limit')) {
        errorMessage = '⏱️ **Rate Limit Reached**\n\nI need a moment to catch my breath! Please wait 30 seconds before sending your next message.\n\nThe 0G Compute Network helps me stay responsive by managing request rates.'
      } else if (error.message.includes('timeout')) {
        errorMessage = '⏳ **Network Timeout**\n\nThe 0G network is experiencing high demand right now. Let me try to process your request again in a moment.\n\nYour message: "' + userMessage.content + '"'
      } else if (error.message.includes('provider')) {
        errorMessage = '🔧 **Provider Unavailable**\n\nMy AI provider is temporarily unavailable. This usually resolves within a few minutes.\n\nTechnical details: ' + error.message
      }
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  if (initializing) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Modern gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 opacity-50" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/agents">
            <Button 
              variant="ghost" 
              className="bg-transparent/0 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white transition-all duration-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Button>
          </Link>
          
          {agent && (
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {agent.metadata?.name || `Agent #${tokenId}`}
              </h1>
              <p className="text-white/60 text-sm">{agent.metadata?.model || 'AI Assistant'}</p>
            </div>
          )}

          {/* Ledger Balance */}
          <div className="hidden md:block">
            <LedgerBalance compact />
          </div>
        </div>

        {/* Mobile Ledger Balance */}
        <div className="md:hidden mb-6">
          <LedgerBalance />
        </div>

        {/* Chat Container */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl h-[calc(100vh-200px)]">
          <CardContent className="p-0 h-full flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`
                    max-w-[80%] p-4 rounded-2xl shadow-lg transition-all duration-300
                    ${message.role === 'user' 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-blue-500/25' 
                      : 'bg-white/10 backdrop-blur border border-white/10 text-white shadow-purple-500/25'
                    }
                  `}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-white/50'}`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/10 backdrop-blur border border-white/10 p-4 rounded-2xl shadow-lg">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                      <span className="text-white/70">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Container */}
            <div className="p-6 border-t border-white/10 bg-white/5">
              <form onSubmit={handleSend} className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={loading || !agent}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-purple-500 focus:ring-purple-500/20"
                />
                <Button 
                  type="submit" 
                  disabled={loading || !input.trim() || !agent}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25 transition-all duration-300"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}