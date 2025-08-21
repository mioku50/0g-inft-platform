// web/app/agent/[id]/chat/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAccount, usePublicClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { INFT_ABI } from '@/lib/contracts/abis'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

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
  const scrollRef = useRef<HTMLDivElement>(null)

  const contractAddress = '0x500AF12C3Fd7aF1665DC85Eff9844054709dF380'

  useEffect(() => {
    if (!publicClient || !tokenId) return

    const loadAgent = async () => {
      try {
        const owner = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: INFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)],
        })

        if (owner?.toLowerCase() !== address?.toLowerCase()) {
          toast({
            title: 'Access Denied',
            description: 'You are not the owner of this agent',
            variant: 'destructive',
          })
          return
        }

        const metadataHash = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: INFT_ABI,
          functionName: 'getMetadataHash',
          args: [BigInt(tokenId)],
        })

        try {
          const response = await fetch('/api/storage/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootHash: metadataHash }),
          })
          
          if (response.ok) {
            const data = await response.json()
            const metadata = JSON.parse(data.content)
            setAgent({ tokenId, owner, metadata })
            
            setMessages([{
              id: '1',
              role: 'assistant',
              content: `Hello! I'm ${metadata.name}. ${metadata.systemPrompt || 'How can I help you today?'}`,
              timestamp: new Date()
            }])
          }
        } catch (error) {
          console.error('Failed to load metadata:', error)
        }
      } catch (error) {
        console.error('Error loading agent:', error)
      } finally {
        setInitializing(false)
      }
    }

    loadAgent()
  }, [publicClient, tokenId, address])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
      // Временная заглушка для тестирования
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm currently in test mode. To enable real AI responses, please set up the 0G Compute integration. Your message was: "${userMessage.content}"`,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      })
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

  if (!agent) {
    return (
      <div className="page-hero min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-xl p-8">
            <p className="text-gray-900 dark:text-white">Agent not found or access denied</p>
            <Link href="/agents">
              <Button className="mt-4">Back to My Agents</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-hero min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Link href="/agents">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Agents
          </Button>
        </Link>

        <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-xl flex flex-col h-[75vh]">
          <div className="px-6 pt-6">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white text-2xl font-semibold">
              <span>🤖</span>
              <span>Chat with {agent.metadata.name}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Model: {agent.metadata.model || 'llama-3.3-70b'}
            </p>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-white/80 dark:bg-gray-900/60 border border-white/20 dark:border-white/10 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      <p className={`${message.role === 'user' ? 'text-purple-100/80' : 'text-gray-500 dark:text-gray-400'} text-[11px] mt-2`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
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
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  disabled={loading}
                  className="flex-1 bg-white/80 dark:bg-gray-900/60 border-white/30 dark:border-white/10 focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60"
                />
                <Button 
                  type="submit" 
                  disabled={loading || !input.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 focus:ring-2 focus:ring-purple-500/60 focus:ring-offset-2 focus:ring-offset-transparent"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}