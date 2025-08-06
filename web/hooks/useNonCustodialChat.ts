/**
 * Non-custodial Chat Hook
 * Uses client wallet for compute operations instead of server-side keys
 */

'use client'

import { useState, useCallback } from 'react'
import { ensureLedger, prepareComputeRequest, isClientBrokerAvailable } from '@/lib/compute/clientBroker'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface NonCustodialChatOptions {
  providerAddress?: string
  model?: string
}

export function useNonCustodialChat() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (
    message: string,
    agentMetadata: { name: string; description: string },
    options: NonCustodialChatOptions = {}
  ) => {
    setLoading(true)
    setError(null)

    try {
      console.log('[CHAT] start')

      // Check if wallet is available
      const walletAvailable = await isClientBrokerAvailable()
      if (!walletAvailable) {
        throw new Error('Connect wallet to view ledger')
      }

      // Ensure ledger exists for the user
      await ensureLedger()

      // Use default provider if none specified
      const providerAddress = options.providerAddress ||
        process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER ||
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

      // Prepare the chat payload
      const payload = {
        messages: [
          {
            role: 'system',
            content: `You are ${agentMetadata.name}. ${agentMetadata.description}`
          },
          {
            role: 'user',
            content: message
          }
        ] as ChatMessage[],
        max_tokens: 1000,
        temperature: 0.7
      }

      console.log('[CHAT] prepared')

      // Prepare signed request
      const preparedRequest = await prepareComputeRequest(providerAddress, payload)

      console.log('[CHAT] fetch')

      // Send to chat API with prepared request
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          agentMetadata,
          providerAddress,
          prepared: true,
          prep: preparedRequest
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      // Handle different response types (JSON or streaming)
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        const data = await response.json()
        
        if (data.choices && data.choices[0]) {
          return {
            content: data.choices[0].message.content,
            model: data.model,
            provider: providerAddress,
            isRealAI: true,
            chatId: data.id
          }
        } else if (data.success && data.response) {
          return {
            content: data.response,
            model: data.model,
            provider: data.provider,
            isRealAI: data.isRealAI,
            metadata: data.metadata
          }
        } else {
          throw new Error(data.error || 'Unexpected response format')
        }
      } else {
        // Handle text response
        const text = await response.text()
        return {
          content: text,
          model: options.model || 'unknown',
          provider: providerAddress,
          isRealAI: true
        }
      }

    } catch (err: any) {
      console.error('[CHAT] Error in non-custodial chat:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const checkWalletStatus = useCallback(async () => {
    try {
      return await isClientBrokerAvailable()
    } catch {
      return false
    }
  }, [])

  const initializeLedger = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      await ensureLedger()
      return true
    } catch (err: any) {
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    sendMessage,
    loading,
    error,
    checkWalletStatus,
    initializeLedger
  }
}