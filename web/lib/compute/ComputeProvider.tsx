/**
 * React Context for Non-Custodial Compute Operations
 * Provides global access to client broker and ledger management
 */

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { getClientBroker, clearBrokerCache, isClientBrokerAvailable } from '@/lib/compute/clientBroker'
import { checkLedgerStatus, createLedgerAccount, LedgerStatus } from '@/lib/compute/ensureLedger'

interface ComputeContextType {
  // Broker state
  broker: any | null
  isLoading: boolean
  error: string | null
  
  // Ledger state
  ledgerStatus: LedgerStatus | null
  
  // Actions
  initializeBroker: () => Promise<void>
  refreshLedgerStatus: () => Promise<void>
  createLedger: (initialDeposit?: number) => Promise<boolean>
  
  // Utilities
  isAvailable: boolean
  address: string | null
}

const ComputeContext = createContext<ComputeContextType | null>(null)

export function useCompute() {
  const context = useContext(ComputeContext)
  if (!context) {
    throw new Error('useCompute must be used within a ComputeProvider')
  }
  return context
}

interface ComputeProviderProps {
  children: ReactNode
}

export function ComputeProvider({ children }: ComputeProviderProps) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  
  const [broker, setBroker] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ledgerStatus, setLedgerStatus] = useState<LedgerStatus | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)

  // Initialize broker when wallet connects
  const initializeBroker = async () => {
    if (!isConnected || !address) {
      setBroker(null)
      setIsAvailable(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('[ComputeProvider] Initializing broker for address:', address)
      
      // Check if client broker is available
      const available = await isClientBrokerAvailable()
      setIsAvailable(available)
      
      if (available) {
        const clientBroker = await getClientBroker()
        setBroker(clientBroker)
        console.log('[ComputeProvider] Broker initialized successfully')
        
        // Refresh ledger status
        await refreshLedgerStatus()
      }
    } catch (err: any) {
      console.error('[ComputeProvider] Failed to initialize broker:', err)
      setError(err.message)
      setBroker(null)
      setIsAvailable(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Refresh ledger status
  const refreshLedgerStatus = async () => {
    if (!isConnected || !address) {
      setLedgerStatus(null)
      return
    }

    try {
      const status = await checkLedgerStatus()
      setLedgerStatus(status)
      console.log('[ComputeProvider] Ledger status:', status)
    } catch (err: any) {
      console.error('[ComputeProvider] Failed to check ledger status:', err)
      setLedgerStatus({
        exists: false,
        balance: '0',
        address,
        needsCreation: true,
        error: err.message
      })
    }
  }

  // Create ledger account
  const createLedger = async (initialDeposit = 0): Promise<boolean> => {
    if (!broker) {
      throw new Error('Broker not initialized')
    }

    try {
      const success = await createLedgerAccount({ 
        initialDeposit,
        onProgress: (step) => console.log('[ComputeProvider]', step)
      })
      
      if (success) {
        await refreshLedgerStatus()
      }
      
      return success
    } catch (err: any) {
      console.error('[ComputeProvider] Failed to create ledger:', err)
      setError(err.message)
      return false
    }
  }

  // Clear broker cache when wallet disconnects or changes
  useEffect(() => {
    if (!isConnected) {
      clearBrokerCache()
      setBroker(null)
      setLedgerStatus(null)
      setIsAvailable(false)
      setError(null)
    }
  }, [isConnected])

  // Initialize broker when wallet connects
  useEffect(() => {
    if (isConnected && address && walletClient) {
      initializeBroker()
    }
  }, [isConnected, address, walletClient])

  const contextValue: ComputeContextType = {
    broker,
    isLoading,
    error,
    ledgerStatus,
    initializeBroker,
    refreshLedgerStatus,
    createLedger,
    isAvailable,
    address: address || null
  }

  return (
    <ComputeContext.Provider value={contextValue}>
      {children}
    </ComputeContext.Provider>
  )
}

export default ComputeProvider