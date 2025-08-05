/**
 * Ledger Account Modal - Non-Custodial UX
 * Shows when user needs to create or fund their ledger account
 */

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, Plus, RefreshCw, ExternalLink } from 'lucide-react'
import { useCompute } from '@/lib/compute/ComputeProvider'
import { depositToLedger } from '@/lib/compute/ensureLedger'

interface LedgerNotFoundModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LedgerNotFoundModal({ isOpen, onClose, onSuccess }: LedgerNotFoundModalProps) {
  const { ledgerStatus, createLedger, refreshLedgerStatus, address } = useCompute()
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [isCreating, setIsCreating] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [step, setStep] = useState<'info' | 'deposit'>('info')

  const handleCreateAccount = async () => {
    setIsCreating(true)
    try {
      const success = await createLedger(0) // Free account creation
      if (success) {
        await refreshLedgerStatus()
        setStep('deposit')
      }
    } catch (error) {
      console.error('Failed to create account:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount)
    if (amount <= 0) return

    setIsDepositing(true)
    try {
      const success = await depositToLedger({
        amount,
        onProgress: (step) => console.log('[LedgerModal]', step)
      })
      
      if (success) {
        await refreshLedgerStatus()
        onSuccess?.()
        onClose()
      }
    } catch (error) {
      console.error('Failed to deposit:', error)
    } finally {
      setIsDepositing(false)
    }
  }

  const handleRefresh = async () => {
    await refreshLedgerStatus()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            0G Compute Ledger Account
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Status */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Account Status</span>
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Address:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
                </code>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Ledger:</span>
                <Badge variant={ledgerStatus?.exists ? 'default' : 'destructive'}>
                  {ledgerStatus?.exists ? 'Exists' : 'Not Found'}
                </Badge>
              </div>
              
              {ledgerStatus?.exists && (
                <div className="flex justify-between text-sm">
                  <span>Balance:</span>
                  <span className="font-mono">{ledgerStatus.balance} OG</span>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          {step === 'info' && (
            <>
              <Alert>
                <AlertDescription>
                  You need a 0G Compute ledger account to use AI services. 
                  Creating an account is free, but you'll need to deposit OG tokens to pay for AI inference.
                </AlertDescription>
              </Alert>

              {!ledgerStatus?.exists ? (
                <Button 
                  onClick={handleCreateAccount} 
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Ledger Account (0 OG)
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={() => setStep('deposit')}
                  className="w-full"
                >
                  Add Funds to Account
                </Button>
              )}
            </>
          )}

          {/* Deposit Step */}
          {step === 'deposit' && (
            <>
              <Alert>
                <AlertDescription>
                  Add OG tokens to your ledger account to pay for AI inference requests.
                  Typical cost: ~0.001 OG per message.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Deposit Amount (OG)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="0.001"
                  step="0.001"
                  placeholder="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum: 0.001 OG • Recommended: 0.01 OG (≈10 messages)
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('info')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleDeposit}
                  disabled={isDepositing || parseFloat(depositAmount) <= 0}
                  className="flex-1"
                >
                  {isDepositing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Depositing...
                    </>
                  ) : (
                    `Deposit ${depositAmount} OG`
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Help Link */}
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" className="w-full justify-center" asChild>
              <a 
                href="https://docs.0g.ai/build-with-0g/compute-network" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                How to add OG tokens
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}