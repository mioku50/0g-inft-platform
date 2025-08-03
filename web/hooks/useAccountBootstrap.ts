'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { toast } from '@/hooks/use-toast'

interface AccountStatus {
  exists: boolean
  balance: string
  needsTopUp: boolean
  minRequired: string
  explicitErrors?: string[]
  provider?: string
}

interface UseAccountBootstrapState {
  account: AccountStatus | null
  loading: boolean
  error: string | null
  showCreateModal: boolean
  showTopUpModal: boolean
}

interface UseAccountBootstrapActions {
  checkAccount: (provider?: string) => Promise<void>
  createAccount: (amount: number, provider?: string) => Promise<void>
  depositFunds: (amount: number, provider?: string) => Promise<void>
  setShowCreateModal: (show: boolean) => void
  setShowTopUpModal: (show: boolean) => void
  refreshAccount: () => Promise<void>
}

/**
 * useAccountBootstrap hook - handles fine-tuning account creation and management
 * Triggered on wallet connect/change as per requirements
 * Provides modal state management for account creation and top-up
 */
export function useAccountBootstrap(): UseAccountBootstrapState & UseAccountBootstrapActions {
  const { address, isConnected } = useAccount()
  
  const [state, setState] = useState<UseAccountBootstrapState>({
    account: null,
    loading: false,
    error: null,
    showCreateModal: false,
    showTopUpModal: false
  })

  // Check account status with optional provider parameter
  const checkAccount = useCallback(async (provider?: string) => {
    if (!isConnected || !address) {
      setState(prev => ({ ...prev, account: null }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const url = new URL('/api/compute/account', window.location.origin)
      if (provider) {
        url.searchParams.set('provider', provider)
      }

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      const accountStatus: AccountStatus = data.result
      setState(prev => ({ 
        ...prev, 
        account: accountStatus, 
        loading: false,
        // Auto-show modals based on account status
        showCreateModal: !accountStatus.exists && !prev.showCreateModal,
        showTopUpModal: accountStatus.exists && accountStatus.needsTopUp && !prev.showTopUpModal
      }))

      // Log account status for debugging
      console.log('[useAccountBootstrap] Account status:', accountStatus)

    } catch (error: any) {
      console.error('[useAccountBootstrap] Failed to check account:', error)
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: error.message,
        account: null
      }))
    }
  }, [isConnected, address])

  // Create new account with initial deposit
  const createAccount = useCallback(async (amount: number, provider?: string) => {
    if (!isConnected || !address || amount <= 0) {
      throw new Error('Invalid parameters for account creation')
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/compute/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'create', 
          amount: amount.toString(),
          provider 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409 && data.error === 'LedgerExists') {
          // Account already exists, update state and maybe show top-up modal
          await checkAccount(provider)
          setState(prev => ({ 
            ...prev, 
            showCreateModal: false,
            showTopUpModal: prev.account?.needsTopUp || false
          }))
          toast({
            title: "Account Already Exists",
            description: `Your fine-tuning account already exists with balance: ${data.details.split(': ')[1]}`,
            variant: "default"
          })
          return
        }
        
        if (response.status === 402) {
          throw new Error('Insufficient wallet balance for transaction')
        }
        
        throw new Error(data.details || data.error || `HTTP ${response.status}`)
      }

      // Success - refresh account status and close modal
      await checkAccount(provider)
      setState(prev => ({ ...prev, showCreateModal: false, loading: false }))
      
      toast({
        title: "Account Created Successfully",
        description: `Fine-tuning account created with ${amount} OG deposit`,
        variant: "default"
      })

    } catch (error: any) {
      console.error('[useAccountBootstrap] Failed to create account:', error)
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      
      toast({
        title: "Account Creation Failed",
        description: error.message,
        variant: "destructive"
      })
      
      throw error
    }
  }, [isConnected, address, checkAccount])

  // Deposit funds to existing account
  const depositFunds = useCallback(async (amount: number, provider?: string) => {
    if (!isConnected || !address || amount <= 0) {
      throw new Error('Invalid parameters for deposit')
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/compute/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'deposit', 
          amount: amount.toString(),
          provider 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409 && data.error === 'LedgerNotExists') {
          // Account doesn't exist, show create modal instead
          setState(prev => ({ 
            ...prev, 
            showTopUpModal: false,
            showCreateModal: true,
            loading: false
          }))
          toast({
            title: "Account Not Found",
            description: "Please create a fine-tuning account first",
            variant: "default"
          })
          return
        }
        
        if (response.status === 402) {
          throw new Error('Insufficient wallet balance for transaction')
        }
        
        throw new Error(data.details || data.error || `HTTP ${response.status}`)
      }

      // Success - refresh account status and close modal
      await checkAccount(provider)
      setState(prev => ({ ...prev, showTopUpModal: false, loading: false }))
      
      toast({
        title: "Funds Deposited Successfully",
        description: `Deposited ${amount} OG to your fine-tuning account`,
        variant: "default"
      })

    } catch (error: any) {
      console.error('[useAccountBootstrap] Failed to deposit funds:', error)
      setState(prev => ({ ...prev, loading: false, error: error.message }))
      
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive"
      })
      
      throw error
    }
  }, [isConnected, address, checkAccount])

  // Modal state setters
  const setShowCreateModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showCreateModal: show }))
  }, [])

  const setShowTopUpModal = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showTopUpModal: show }))
  }, [])

  // Refresh account status
  const refreshAccount = useCallback(async () => {
    await checkAccount(state.account?.provider)
  }, [checkAccount, state.account?.provider])

  // Auto-check account on wallet connect/change
  useEffect(() => {
    if (isConnected && address) {
      console.log('[useAccountBootstrap] Wallet connected, checking account status...')
      checkAccount()
    } else {
      setState(prev => ({ 
        ...prev, 
        account: null, 
        showCreateModal: false, 
        showTopUpModal: false 
      }))
    }
  }, [isConnected, address, checkAccount])

  return {
    ...state,
    checkAccount,
    createAccount,
    depositFunds,
    setShowCreateModal,
    setShowTopUpModal,
    refreshAccount
  }
}

export type { AccountStatus, UseAccountBootstrapState, UseAccountBootstrapActions }