'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { 
  Wallet, 
  Plus, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  Zap,
  Copy,
  ExternalLink
} from 'lucide-react'
import { getClientBroker, ensureLedger, getCurrentWalletAddress, isClientBrokerAvailable } from '@/lib/compute/clientBroker'

interface LedgerBalanceProps {
  className?: string
  compact?: boolean
}

interface LedgerInfo {
  address: string
  balance: string
  balanceFormatted: string
  exists: boolean
}

export function LedgerBalance({ className = '', compact = false }: LedgerBalanceProps) {
  const { address, isConnected } = useAccount()
  const { toast } = useToast()
  
  const [ledgerInfo, setLedgerInfo] = useState<LedgerInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toppingUp, setToppingUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('0.01')
  const [error, setError] = useState<string | null>(null)

  // Load ledger info when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadLedgerInfo()
    } else {
      setLedgerInfo(null)
      setError(null)
    }
  }, [isConnected, address])

  const loadLedgerInfo = async () => {
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

      // Try to get ledger info
      try {
        const balance = await broker.ledger.getBalance()
        
        setLedgerInfo({
          address: currentAddress,
          balance: balance.toString(),
          balanceFormatted: parseFloat(balance).toFixed(6),
          exists: true
        })
      } catch (err: any) {
        // Ledger doesn't exist yet
        console.log('[LedgerBalance] Ledger not found, needs creation')
        setLedgerInfo({
          address: currentAddress,
          balance: '0',
          balanceFormatted: '0.000000',
          exists: false
        })
      }
    } catch (err: any) {
      console.error('[LedgerBalance] Error loading ledger info:', err)
      setError(`Failed to load ledger: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const createLedger = async () => {
    setCreating(true)
    setError(null)
    
    try {
      console.log('[LedgerBalance] Creating ledger account...')
      await ensureLedger()
      
      toast({
        title: "Ledger Created",
        description: "Your 0G Ledger account has been created successfully!",
      })
      
      // Reload ledger info
      await loadLedgerInfo()
    } catch (err: any) {
      console.error('[LedgerBalance] Error creating ledger:', err)
      setError(`Failed to create ledger: ${err.message}`)
      toast({
        title: "Creation Failed",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  const topUpLedger = async () => {
    if (!ledgerInfo || !topUpAmount) return
    
    setToppingUp(true)
    setError(null)
    
    try {
      console.log(`[LedgerBalance] Adding ${topUpAmount} ETH to ledger...`)
      const broker = await getClientBroker()
      await broker.ledger.addLedger(parseFloat(topUpAmount))
      
      toast({
        title: "Top-up Successful",
        description: `Added ${topUpAmount} ETH to your ledger!`,
      })
      
      // Reload balance
      await loadLedgerInfo()
    } catch (err: any) {
      console.error('[LedgerBalance] Error topping up:', err)
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

  const copyAddress = () => {
    if (ledgerInfo) {
      navigator.clipboard.writeText(ledgerInfo.address)
      toast({
        title: "Copied",
        description: "Ledger address copied to clipboard",
      })
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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
                {ledgerInfo.balanceFormatted} ETH
              </span>
              {!ledgerInfo.exists && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  Not Created
                </Badge>
              )}
            </div>
            
            {!ledgerInfo.exists ? (
              <Button 
                size="sm" 
                variant="outline"
                onClick={createLedger}
                disabled={creating}
                className="h-6 px-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30"
              >
                {creating ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
              </Button>
            ) : (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setTopUpAmount('0.01')}
                disabled={toppingUp}
                className="h-6 px-2 text-xs bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/30"
              >
                {toppingUp ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </Button>
            )}
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
        {/* Address */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Address</span>
            <div className="flex items-center gap-2">
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {formatAddress(ledgerInfo.address)}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyAddress}
                className="h-6 w-6 p-0"
              >
                <Copy size={12} />
              </Button>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Balance</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-purple-400">
                {ledgerInfo.balanceFormatted} ETH
              </span>
              {ledgerInfo.exists ? (
                <Badge variant="outline" className="text-xs">
                  <CheckCircle size={10} className="mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-orange-400">
                  <AlertCircle size={10} className="mr-1" />
                  Not Created
                </Badge>
              )}
            </div>
          </div>
          
          {parseFloat(ledgerInfo.balanceFormatted) < 0.001 && ledgerInfo.exists && (
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle size={12} />
              Low balance - may not be sufficient for compute operations
            </div>
          )}
        </div>
        
        <Separator />
        
        {/* Actions */}
        <div className="space-y-3">
          {!ledgerInfo.exists ? (
            <Button 
              onClick={createLedger}
              disabled={creating}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Plus size={16} className="mr-2" />
              )}
              Create Ledger Account
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0.001"
                  max="1"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="Amount to add"
                  className="bg-background/50"
                />
                <Button 
                  onClick={topUpLedger}
                  disabled={toppingUp || !topUpAmount || parseFloat(topUpAmount) <= 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {toppingUp ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Top Up
                </Button>
              </div>
              
              <div className="flex gap-1">
                {['0.01', '0.05', '0.1'].map((amount) => (
                  <Button
                    key={amount}
                    size="sm"
                    variant="outline"
                    onClick={() => setTopUpAmount(amount)}
                    className="flex-1 text-xs h-7 bg-purple-600/10 hover:bg-purple-600/20 border-purple-500/30"
                  >
                    +{amount} ETH
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          💡 This ledger account is used to pay for AI compute operations on the 0G Network
        </div>
      </CardContent>
    </Card>
  )
}