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

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

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
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          agentMetadata: agent?.metadata,
          providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd' // llama-3.3-70b
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
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      
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
      <div className="container mx-auto py-10 flex items-center justify-center min-h-[600px]">
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
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            {agent?.metadata?.image ? (
              <img 
                src={agent.metadata.image} 
                alt={agent.metadata.name}
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=agent-${tokenId}`
                }}
              />
            ) : (
              <span className="text-2xl">🤖</span>
            )}
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
                    <p className="text-xs opacity-70 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
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
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}