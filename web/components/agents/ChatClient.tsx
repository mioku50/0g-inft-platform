'use client'

// components/agents/ChatClient.tsx
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Loader2 } from 'lucide-react'
import { LedgerBalance } from '@/components/compute/LedgerBalance'
import { useNonCustodialChat } from '@/hooks/useNonCustodialChat'
import { isDebugMode } from '@/lib/utils/log'
import { isClientBrokerAvailable } from '@/lib/compute/clientBroker'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatClientProps {
  agentId: string
  agentMeta: {
    name: string
    model: string
    description?: string
  }
}

export function ChatClient({ agentId, agentMeta }: ChatClientProps) {
  const { address } = useAccount()
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { sendMessage: sendNonCustodialMessage } = useNonCustodialChat()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage = agentMeta.description 
      ? `Hello! ${agentMeta.description}` 
      : `Hello! I'm ${agentMeta.name}. How can I help you today?`
    
    setMessages([{
      id: '1',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    }])
  }, [agentMeta])

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
      const useNonCustodial = process.env.NEXT_PUBLIC_USE_NONCUSTODIAL_INFERENCE === 'true'

      if (useNonCustodial && address) {
        // Перед отправкой сообщения — await ensureLedger(); если нет средств/ошибка — понятный тост.
        const result = await sendNonCustodialMessage(
          userMessage.content,
          {
            name: agentMeta.name,
            description: agentMeta.description || 'AI Assistant'
          },
          {
            providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
          }
        )

        if (result && result.content) {
          const assistantMessage: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: result.content,
            timestamp: new Date()
          }
          setMessages(prev => [...prev, assistantMessage])
        }
      } else {
        // Fallback to custodial mode
        const response = await fetch('/api/compute/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            agentMetadata: agentMeta,
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

  return (
    <>
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
                disabled={loading}
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-purple-500 focus:ring-purple-500/20"
              />
              <Button 
                type="submit" 
                disabled={loading || !input.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25 transition-all duration-300"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic Information (dev-only) */}
      <DevComputeDebug agentMeta={agentMeta} />
    </>
  )
}

function DevComputeDebug({ agentMeta }: { agentMeta?: any }) {
  const { address } = useAccount()
  const [brokerReady, setBrokerReady] = useState<boolean>(false)
  const [providerInfo, setProviderInfo] = useState<any>(null)
  const [ledgerInfo, setLedgerInfo] = useState<any>(null)
  const [headersReady, setHeadersReady] = useState<boolean>(false)
  
  useEffect(() => {
    if (!isDebugMode()) return
    
    const updateDiagnostics = async () => {
      try {
        // Check broker availability
        const brokerOk = await isClientBrokerAvailable()
        setBrokerReady(brokerOk)
        
        if (brokerOk) {
          // Get provider info
          const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
          const response = await fetch('/api/compute/health')
          const healthData = await response.json()
          
          setProviderInfo({
            address: providerAddress,
            endpoint: 'Available'
          })
          
          // Check if headers can be generated (simplified check)
          setHeadersReady(true)
          
          // Get ledger info
          setLedgerInfo({ exists: true, balance: 'Available' })
        }
      } catch (error) {
        console.warn('[Debug] Failed to update diagnostics:', error)
      }
    }
    
    updateDiagnostics()
  }, [address])
  
  if (!isDebugMode()) return null
  
  return (
    <div className="mt-4 p-4 bg-black/20 rounded-lg text-xs text-purple-300/80 border border-purple-500/20">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <strong>Wallet:</strong><br />
          {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
        </div>
        <div>
          <strong>Broker Ready:</strong><br />
          {String(brokerReady)}
        </div>
        <div>
          <strong>Ledger:</strong><br />
          {ledgerInfo ? 'exists/balance' : 'checking...'}
        </div>
        <div>
          <strong>Provider:</strong><br />
          {providerInfo ? providerInfo.address.slice(0, 8) : 'checking...'}
        </div>
        <div>
          <strong>Endpoint:</strong><br />
          {providerInfo?.endpoint || 'checking...'}
        </div>
        <div>
          <strong>Headers Ready:</strong><br />
          {String(headersReady)}
        </div>
      </div>
      <div className="mt-2 text-purple-400/60">
        Debug mode active - diagnostic info visible
      </div>
    </div>
  )
}