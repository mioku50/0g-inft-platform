'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Wallet, Plus, Loader2, AlertCircle, Zap, RefreshCw } from 'lucide-react'
import { getClientBroker, ensureLedger, getCurrentWalletAddress, isClientBrokerAvailable } from '@/lib/compute/clientBroker'
import { LEDGER_LOG } from '@/lib/utils/log'

interface LedgerBalanceProps {
  className?: string
  compact?: boolean
}

interface LedgerInfo {
  address: string
  balance: string
  balanceFormatted: string
}

export function LedgerBalance({ className = '', compact = false }: LedgerBalanceProps) {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  
  const [ledgerInfo, setLedgerInfo] = useState<LedgerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [toppingUp, setToppingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Client-side only rendering guard
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load ledger info when wallet connects
  useEffect(() => {
    if (isClient && isConnected && address) {
      loadLedgerInfo()
    } else {
      setLedgerInfo(null)
      setError(null)
    }
  }, [isClient, isConnected, address])

  const loadLedgerInfo = async () => {
    if (typeof window === 'undefined') return
    
    setLoading(true)
    setError(null)
    
    try {
      const walletAvailable = await isClientBrokerAvailable()
      if (!walletAvailable) {
        setError('Wallet not connected')
        return
      }

      const broker = await getClientBroker()
      const currentAddress = await getCurrentWalletAddress()

      if (!currentAddress) {
        setError('Unable to get wallet address')
        return
      }

      // Try to get existing ledger first
      try {
        const ledger = await broker.ledger.getLedger()
        const balanceWei = ledger.balance
        const balanceOG = ethers.formatEther(balanceWei)
        setLedgerInfo({
          address: currentAddress,
          balance: balanceWei.toString(),
          balanceFormatted: parseFloat(balanceOG).toFixed(6)
        })
        LEDGER_LOG('Existing ledger found with balance:', balanceOG, 'OG')
        return
      } catch (ledgerError: any) {
        LEDGER_LOG('No existing ledger, will create one')
      }

      // Auto-create ledger if it doesn't exist
      LEDGER_LOG('Creating ledger with 0.01 OG')
      await broker.ledger.addLedger(ethers.parseEther('0.01'))
      
      // Get the new balance
      const ledger = await broker.ledger.getLedger()
      const balanceWei = ledger.balance
      const balanceOG = ethers.formatEther(balanceWei)
      setLedgerInfo({
        address: currentAddress,
        balance: balanceWei.toString(),
        balanceFormatted: parseFloat(balanceOG).toFixed(6)
      })
      
      LEDGER_LOG('Ledger created successfully with balance:', balanceOG, 'OG')
    } catch (err: any) {
      LEDGER_LOG('Error loading ledger info:', err)
      setError(`Failed to load ledger: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const [showTopUpDialog, setShowTopUpDialog] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('0.01')

  const topUpLedger = async () => {
    if (!ledgerInfo || typeof window === 'undefined') return

    setToppingUp(true)
    setError(null)

    try {
      const amount = topUpAmount.trim()
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount')
      }

      LEDGER_LOG(`Depositing ${amount} OG to ledger...`)
      const broker = await getClientBroker()
      await broker.ledger.depositFund(ethers.parseEther(amount))

      toast({
        title: "Top-up Successful",
        description: `Added ${amount} OG to your ledger!`,
      })

      // Refresh balance after top-up
      await loadLedgerInfo()
      setShowTopUpDialog(false)
      setTopUpAmount('0.01')
    } catch (err: any) {
      LEDGER_LOG('Error topping up:', err)
      setError(`Top-up failed: ${err.message}`)
      toast({
        title: "Top-up Failed",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setToppingUp(false)
    }
  }

  // Show nothing during SSR
  if (!isClient) {
    return null
  }

  if (!isConnected) {
    return (
      <Card className={`${className} ${compact ? 'p-2' : ''}`}>
        <CardContent className={compact ? 'p-3' : 'p-4'}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet size={compact ? 16 : 20} />
            <span className={compact ? 'text-sm' : ''}>Connect wallet to view ledger</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className={`${className} ${compact ? 'p-2' : ''}`}>
        <CardContent className={compact ? 'p-3' : 'p-4'}>
          <div className="flex items-center gap-2">
            <Loader2 size={compact ? 16 : 20} className="animate-spin" />
            <span className={compact ? 'text-sm' : ''}>Loading ledger info...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={`${className} ${compact ? 'p-2' : ''} border-destructive`}>
        <CardContent className={compact ? 'p-3' : 'p-4'}>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={compact ? 16 : 20} />
            <span className={compact ? 'text-sm' : ''}>{error}</span>
          </div>
          <Button 
            variant="outline" 
            size={compact ? 'sm' : 'default'} 
            onClick={loadLedgerInfo}
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!ledgerInfo) {
    return null
  }

  // Compact view for chat header
  if (compact) {
    return (
      <Card className={`${className} bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-purple-500/20`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-purple-400" />
              <span className="text-sm font-medium">
                {ledgerInfo.balanceFormatted} OG
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={loadLedgerInfo}
                disabled={loading}
                className="h-6 px-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={topUpLedger}
                disabled={toppingUp}
                className="h-6 px-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30"
              >
                {toppingUp ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Full view for chat page
  return (
    <Card className={`${className} bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-purple-500/20`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="text-purple-400" />
          0G Ledger Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Balance</span>
          <span className="text-lg font-bold text-purple-400">{ledgerInfo.balanceFormatted} OG</span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={loadLedgerInfo}
            disabled={loading}
            className="flex-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30"
            variant="outline"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </Button>
          <Button
            onClick={topUpLedger}
            disabled={toppingUp}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {toppingUp ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span className="ml-2">Fund 0.01 OG</span>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          💡 This ledger account is used to pay for AI compute operations on the 0G Network
        </div>
      </CardContent>
    </Card>
  )
}