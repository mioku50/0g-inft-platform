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

  const contractAddress = '0x500AF12C3Fd7aF1665DC85Eff9844054709dF380'

  useEffect(() => {
    if (!publicClient || !tokenId) return

    const loadAgent = async () => {
      try {
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
            setAgent({ tokenId, metadata })
            
            setMessages([{
              id: '1',
              role: 'assistant',
              content: `Hello! I'm ${metadata.name}. ${metadata.description}`,
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
  }, [publicClient, tokenId])

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

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `You said: "${userMessage.content}". Real AI integration with 0G Compute coming soon!`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setLoading(false)
    }, 1000)
  }

  if (initializing) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <Link href="/agents">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Agents
        </Button>
      </Link>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            Chat with {agent?.metadata?.name || `Agent #${tokenId}`}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Model: {agent?.metadata?.model || 'llama-3.3-70b'}
          </p>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="border-t p-4">
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
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
