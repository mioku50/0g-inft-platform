'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, Plus, AlertCircle, DollarSign } from 'lucide-react'
import { AccountStatus } from '@/hooks/useAccountBootstrap'

interface AccountBootstrapModalProps {
  isOpen: boolean
  onClose: () => void
  account: AccountStatus | null
  loading: boolean
  onCreateAccount: (amount: number) => Promise<void>
  onDepositFunds: (amount: number) => Promise<void>
}

/**
 * AccountBootstrapModal - Guides new wallets through account creation/funding
 * Implements proper wallet onboarding as per requirements
 */
export function AccountBootstrapModal({
  isOpen,
  onClose,
  account,
  loading,
  onCreateAccount,
  onDepositFunds
}: AccountBootstrapModalProps) {
  const [amount, setAmount] = useState('0.01')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const needsAccount = !account?.exists
  const needsTopUp = account?.exists && account?.needsTopUp
  const isReady = account?.exists && !account?.needsTopUp

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return
    }

    setIsSubmitting(true)
    try {
      if (needsAccount) {
        await onCreateAccount(amountNum)
      } else if (needsTopUp) {
        await onDepositFunds(amountNum)
      }
      onClose()
    } catch (error) {
      console.error('Bootstrap action failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const recommendedAmount = needsAccount ? 0.01 : 0.005

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {needsAccount ? 'Create Fine-tuning Account' : needsTopUp ? 'Add Funds' : 'Account Ready'}
          </DialogTitle>
          <DialogDescription>
            {needsAccount 
              ? 'Create your fine-tuning account to start training AI models'
              : needsTopUp 
              ? 'Your account needs more funds to continue fine-tuning'
              : 'Your fine-tuning account is ready to use'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Account exists</span>
                <span className={`text-sm font-medium ${account?.exists ? 'text-green-600' : 'text-red-600'}`}>
                  {account?.exists ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              
              {account?.exists && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current balance</span>
                    <span className="text-sm font-medium">{account.balance} OG</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Minimum required</span>
                    <span className="text-sm font-medium">{account.minRequired || '0.001'} OG</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Action Required */}
          {(needsAccount || needsTopUp) && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Action Required
                </CardTitle>
                <CardDescription>
                  {needsAccount 
                    ? 'You need to create a fine-tuning account with an initial deposit'
                    : 'Your account balance is too low for fine-tuning operations'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    {needsAccount ? 'Initial deposit amount (OG)' : 'Top-up amount (OG)'}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-10"
                      placeholder="0.01"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Recommended: {recommendedAmount} OG for {needsAccount ? 'account creation' : 'top-up'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setAmount(recommendedAmount.toString())}
                    variant="outline"
                    size="sm"
                    disabled={loading || isSubmitting}
                  >
                    Use Recommended
                  </Button>
                  
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || isSubmitting || parseFloat(amount) <= 0}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      'Processing...'
                    ) : needsAccount ? (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Create Account
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Funds
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ready State */}
          {isReady && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <div className="text-green-600 text-2xl">✓</div>
                  <p className="text-sm font-medium text-green-800">Account Ready</p>
                  <p className="text-xs text-green-600">
                    You can now start fine-tuning AI models with your current balance of {account?.balance} OG
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Important Notes */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-800">Important Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-blue-700">
              <p>• Fine-tuning costs are automatically deducted from your account balance</p>
              <p>• Platform covers all gas fees - you only pay for AI training</p>
              <p>• Funds are stored securely in the 0G Compute Network</p>
              <p>• You can add more funds anytime by visiting this account page</p>
            </CardContent>
          </Card>

          {/* Close button */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading || isSubmitting}>
              {isReady ? 'Continue' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}