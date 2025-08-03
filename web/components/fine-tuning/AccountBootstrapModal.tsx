'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, AlertCircle, CheckCircle } from 'lucide-react'

interface AccountBootstrapModalProps {
  type: 'create' | 'topup'
  open: boolean
  onClose: () => void
  onSubmit: (amount: number, provider?: string) => Promise<void>
  loading: boolean
  currentBalance?: string
  minRequired?: string
  provider?: string
}

export function AccountBootstrapModal({
  type,
  open,
  onClose,
  onSubmit,
  loading,
  currentBalance = '0',
  minRequired = '0.001',
  provider
}: AccountBootstrapModalProps) {
  const [amount, setAmount] = useState(type === 'create' ? '0.01' : '0.005')
  const [error, setError] = useState<string | null>(null)

  const isCreate = type === 'create'
  const title = isCreate ? 'Create Fine-tuning Account' : 'Add Funds to Account'
  const description = isCreate
    ? 'Create a new fine-tuning account with an initial deposit to start training AI models'
    : `Your current balance is ${currentBalance} OG. Add funds to continue fine-tuning.`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number')
      return
    }

    if (numAmount < parseFloat(minRequired)) {
      setError(`Minimum amount is ${minRequired} OG`)
      return
    }

    try {
      await onSubmit(numAmount, provider)
      onClose()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleClose = () => {
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Status */}
          {!isCreate && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Current balance: <strong>{currentBalance} OG</strong><br />
                Required minimum: <strong>{minRequired} OG</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Provider Info */}
          {provider && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Provider: <code className="text-xs">{provider}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (OG)</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              min={minRequired}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimum ${minRequired} OG`}
              disabled={loading}
            />
            <div className="text-xs text-muted-foreground">
              {isCreate ? (
                <>
                  Default: 0.01 OG (recommended for testing)<br />
                  Production: 0.1+ OG for multiple training sessions
                </>
              ) : (
                <>
                  Add enough funds for your planned training sessions<br />
                  Each training typically costs 0.001-0.01 OG
                </>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isCreate ? 'Create Account' : 'Add Funds'}
            </Button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-sm space-y-1">
            <div className="font-medium">How it works:</div>
            <div className="text-muted-foreground text-xs space-y-1">
              <div>• {isCreate ? 'Creates' : 'Adds funds to'} your fine-tuning account on 0G Network</div>
              <div>• Platform pays gas fees - you only pay for training costs</div>
              <div>• Funds are held securely in the 0G Compute Ledger contract</div>
              <div>• {isCreate && provider && 'Automatically acknowledges the selected provider'}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AccountBootstrapModal