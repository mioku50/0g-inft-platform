/**
 * Non-custodial chat hook
 * Uses client broker to interact directly with 0G providers
 */

import { useState, useCallback } from 'react'
import { useCompute } from '@/lib/compute/ComputeProvider'
import { ensureLedgerAccount } from '@/lib/compute/ensureLedger'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  model?: string
  provider?: string
  verified?: boolean
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  preferredProvider?: string
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (content: string, agentMetadata: any, options?: ChatOptions) => Promise<void>
  clearMessages: () => void
  isWalletConnected: boolean
  ledgerReady: boolean
  initializeLedger: () => Promise<boolean>
}

export function useChat(): UseChatReturn {
  const { broker, ledgerStatus, isAvailable, address, createLedger } = useCompute()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isWalletConnected = isAvailable && !!address
  const ledgerReady = !!ledgerStatus?.exists && parseFloat(ledgerStatus.balance) > 0

  const initializeLedger = useCallback(async (): Promise<boolean> => {
    if (!broker) {
      setError('Wallet not connected')
      return false
    }

    try {
      // Create ledger account if needed
      if (!ledgerStatus?.exists) {
        const success = await createLedger(0.01) // Create with minimal deposit
        if (!success) {
          setError('Failed to create ledger account')
          return false
        }
      }

      return true
    } catch (err: any) {
      setError(`Ledger initialization failed: ${err.message}`)
      return false
    }
  }, [broker, ledgerStatus, createLedger])

  const sendMessage = useCallback(async (
    content: string, 
    agentMetadata: any, 
    options: ChatOptions = {}
  ): Promise<void> => {
    if (!broker) {
      setError('Please connect your wallet first')
      return
    }

    if (!ledgerReady) {
      setError('Please initialize your ledger account first')
      return
    }

    setIsLoading(true)
    setError(null)

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Get available services from broker
      const services = await broker.listService()
      if (!services || services.length === 0) {
        throw new Error('No 0G compute services available')
      }

      // Select provider (use preferred or first available)
      const provider = options.preferredProvider 
        ? services.find((s: any) => s.provider === options.preferredProvider) || services[0]
        : services[0]

      console.log('[useChat] Using provider:', provider.provider)

      // Get service metadata (endpoint and model)
      const { endpoint, model } = await broker.getServiceMetadata(provider.provider)

      // Acknowledge provider if not already done
      try {
        await broker.inference.acknowledgeProviderSigner(provider.provider)
      } catch (ackError) {
        console.log('[useChat] Provider already acknowledged:', (ackError as Error).message)
      }

      // Generate request headers with billing info
      const headers = await broker.inference.getRequestHeaders(provider.provider, content)

      // Prepare payload for OpenAI-compatible API
      const payload = {
        messages: [
          {
            role: 'system',
            content: `You are ${agentMetadata.name}. ${agentMetadata.description}${agentMetadata.personality ? ` Your personality is ${agentMetadata.personality}.` : ''}`
          },
          { role: 'user', content }
        ],
        model,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000
      }

      console.log('[useChat] Sending request to provider endpoint')

      // Make direct request to provider endpoint
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Provider error (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      
      // Extract response content
      const assistantContent = result.choices?.[0]?.message?.content || 'No response generated'

      // Process response for verification (if supported)
      let verified = false
      try {
        if (result.id && provider.verifiability === 'TeeML') {
          verified = await broker.inference.processResponse(
            provider.provider,
            assistantContent,
            result.id
          )
        }
      } catch (verifyError) {
        console.warn('[useChat] Verification failed:', (verifyError as Error).message)
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        model,
        provider: provider.provider,
        verified
      }

      setMessages(prev => [...prev, assistantMessage])

    } catch (err: any) {
      console.error('[useChat] Send message error:', err)
      setError(err.message)
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${err.message}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [broker, ledgerReady])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    isWalletConnected,
    ledgerReady,
    initializeLedger
  }
}