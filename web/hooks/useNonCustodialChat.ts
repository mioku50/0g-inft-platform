/**
 * Non-custodial Chat Hook
 * Uses client wallet for compute operations instead of server-side keys
 */

'use client'

import { useState, useCallback } from 'react'
import { ensureLedger, prepareComputeRequest, isClientBrokerAvailable, getClientBroker } from '@/lib/compute/clientBroker'
import { useToast } from '@/hooks/use-toast'

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
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const sendMessage = useCallback(async (
    message: string,
    agentMetadata: { name: string; description: string },
    options: NonCustodialChatOptions = {}
  ) => {
    // Prevent double clicks
    if (isSending) {
      toast({
        title: "Please wait",
        description: "Previous message is still being sent",
        variant: "default"
      })
      return null
    }

    setIsSending(true)
    setLoading(true)
    setError(null)

    try {
      console.log('[CHAT] start')

      // Check if wallet is available
      const walletAvailable = await isClientBrokerAvailable()
      if (!walletAvailable) {
        toast({
          title: "Wallet Required",
          description: "Please connect your wallet to use non-custodial chat",
          variant: "destructive"
        })
        throw new Error('Connect wallet to view ledger')
      }

      // Ensure ledger exists for the user
      toast({
        title: "Preparing ledger",
        description: "Creating or verifying your compute ledger...",
      })
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
      let responseContent: string = ''
      let responseData: any = null
      
      if (contentType?.includes('application/json')) {
        const data = await response.json()
        responseData = data
        
        if (data.choices && data.choices[0]) {
          responseContent = data.choices[0].message.content
        } else if (data.success && data.response) {
          responseContent = data.response
        } else {
          throw new Error(data.error || 'Unexpected response format')
        }
      } else {
        // Handle text response
        responseContent = await response.text()
      }

      // After getting the response from proxy, call processResponse
      try {
        const broker = await getClientBroker()
        const completionId = responseData?.id || 'completion-' + Date.now()
        await broker.inference.processResponse(providerAddress, responseContent, completionId)
        console.log('[CHAT] processResponse called successfully')
      } catch (processError: any) {
        console.warn('[CHAT] processResponse failed (non-critical):', processError.message)
        // Don't throw here as the chat response was successful
      }

      // Return the response
      if (contentType?.includes('application/json') && responseData) {
        if (responseData.choices && responseData.choices[0]) {
          return {
            content: responseContent,
            model: responseData.model,
            provider: providerAddress,
            isRealAI: true,
            chatId: responseData.id
          }
        } else if (responseData.success && responseData.response) {
          return {
            content: responseContent,
            model: responseData.model,
            provider: responseData.provider,
            isRealAI: responseData.isRealAI,
            metadata: responseData.metadata
          }
        }
      } else {
        return {
          content: responseContent,
          model: options.model || 'unknown',
          provider: providerAddress,
          isRealAI: true
        }
      }

    } catch (err: any) {
      console.error('[CHAT] Error in non-custodial chat:', err)
      setError(err.message)
      
      // Show appropriate error toast
      if (err.message.includes('insufficient funds')) {
        toast({
          title: "Insufficient Funds",
          description: "Please top up your ledger balance",
          variant: "destructive"
        })
      } else if (err.message.includes('Headers already used')) {
        toast({
          title: "Headers Expired",
          description: "Retrying with fresh headers...",
          variant: "default"
        })
      } else {
        toast({
          title: "Chat Error",
          description: err.message,
          variant: "destructive"
        })
      }
      
      throw err
    } finally {
      setLoading(false)
      setIsSending(false)
    }
  }, [toast, isSending])

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