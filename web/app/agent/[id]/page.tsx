'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { INFT_ABI } from '@/lib/contracts/abis'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metadata?: {
    model?: string
    provider?: string
    isRealAI?: boolean
    ttfb?: number
  }
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
  const scrollRef = useRef<HTMLDivElement>(null)

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  useEffect(() => {
    if (!publicClient || !tokenId) return

    const loadAgent = async () => {
      try {
        // Prefer getEncryptedURI, fallback to getMetadataHash
        let metadataHash = ''
        try {
          metadataHash = await publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'getEncryptedURI',
            args: [BigInt(tokenId)],
          }) as string
        } catch {
          try {
            metadataHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getMetadataHash',
              args: [BigInt(tokenId)],
            }) as string
          } catch {}
        }

        if (metadataHash && metadataHash !== '0x' && metadataHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          try {
            const response = await fetch('/api/storage/retrieve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rootHash: metadataHash, tokenId })
            })
            if (response.ok) {
              const data = await response.json()
              const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
              setAgent({ tokenId, metadata })
              const welcomeMessage = metadata.systemPrompt
                ? `Hello! ${metadata.systemPrompt.split('.')[0]}.`
                : `Hello! I'm ${metadata.name}. ${metadata.description || 'How can I help you today?'}`
              setMessages([{ id: '1', role: 'assistant', content: welcomeMessage, timestamp: new Date() }])
            } else {
              throw new Error('Failed to retrieve metadata')
            }
          } catch {
            const fallbackMetadata = {
              name: `Agent #${tokenId}`,
              description: 'AI Assistant',
              model: 'llama-3.3-70b',
              personality: 'friendly'
            }
            setAgent({ tokenId, metadata: fallbackMetadata })
            setMessages([{ id: '1', role: 'assistant', content: `Hello! I'm Agent #${tokenId}. How can I help you today?`, timestamp: new Date() }])
          }
        } else {
          const fallbackMetadata = {
            name: `Agent #${tokenId}`,
            description: 'AI Assistant',
            model: 'llama-3.3-70b',
            personality: 'friendly'
          }
          setAgent({ tokenId, metadata: fallbackMetadata })
          setMessages([{ id: '1', role: 'assistant', content: `Hello! I'm Agent #${tokenId}. How can I help you today?`, timestamp: new Date() }])
        }
      } finally {
        setInitializing(false)
      }
    }

    loadAgent()
  }, [publicClient, tokenId, contractAddress])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

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
      const startTime = Date.now()
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(address ? { 'x-address': address } : {}) },
        body: JSON.stringify({
          message: userMessage.content,
          agentMetadata: agent?.metadata,
          providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
          agentId: Number(tokenId)
        }),
      })

      const data = await response.json()
      const ttfb = Date.now() - startTime

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          metadata: {
            model: data.model,
            provider: data.provider,
            isRealAI: data.isRealAI,
            ttfb: data.ttfb || ttfb
          }
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error. Please try again later.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } finally {
      setLoading(false)
    }
  }

  if (initializing) {
    return (
      <div className="page-hero min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  return (
    <div className="page-hero min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 relative z-10">
        <Link href="/agents">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Agents
          </Button>
        </Link>

        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl flex flex-col h-[75vh]">
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                {agent?.metadata?.image ? (
                  <img
                    src={agent.metadata.image}
                    alt={agent.metadata.name}
                    className="w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=agent-${tokenId}`
                    }}
                  />
                ) : (
                  <span className="text-2xl">🤖</span>
                )}
                <span className="text-2xl font-semibold">{agent?.metadata?.name || `Agent #${tokenId}`}</span>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Model: {agent?.metadata?.model || 'llama-3.3-70b'}</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${message.role === 'user' ? 'bg-gray-900 text-white' : 'bg-white/80 dark:bg-gray-900/60 border border-white/20 dark:border-white/10 text-gray-900 dark:text-gray-100'}`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p className={`${message.role === 'user' ? 'text-purple-100/80' : 'text-gray-500 dark:text-gray-400'} text-[11px] mt-2`}>{message.timestamp.toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white/70 dark:bg-gray-900/60 border border-white/20 dark:border-white/10 rounded-2xl p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/30 dark:border-white/10 p-4 mt-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
                className="flex gap-2 items-end"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Type your message..."
                  disabled={loading}
                  className="flex-1 min-h-[56px] bg-white/80 dark:bg-gray-900/60 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60"
                />
                <Button type="submit" disabled={loading || !input.trim()} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}