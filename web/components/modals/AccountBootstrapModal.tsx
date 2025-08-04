/**
 * Account Bootstrap Modal - Guided Account Creation for New Wallets
 * Implements seamless onboarding as per requirements
 */

'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, CreditCard, CheckCircle, AlertCircle } from 'lucide-react'
import { AccountStatus } from '@/hooks/useAccountBootstrap'

interface AccountBootstrapModalProps {
  isOpen: boolean
  onClose: () => void
  account: AccountStatus | null
  loading: boolean
  error: string | null
  onCreateAccount: (amount: number) => Promise<void>
  onDepositFunds: (amount: number) => Promise<void>
}

export function AccountBootstrapModal({
  isOpen,
  onClose,
  account,
  loading,
  error,
  onCreateAccount,
  onDepositFunds
}: AccountBootstrapModalProps) {
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [actionLoading, setActionLoading] = useState(false)

  const handleCreateAccount = async () => {
    const amount = parseFloat(depositAmount)
    if (amount <= 0 || amount > 10) {
      return
    }

    setActionLoading(true)
    try {
      await onCreateAccount(amount)
    } catch (error) {
      console.error('Account creation failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddFunds = async () => {
    const amount = parseFloat(depositAmount)
    if (amount <= 0 || amount > 10) {
      return
    }

    setActionLoading(true)
    try {
      await onDepositFunds(amount)
    } catch (error) {
      console.error('Deposit failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const needsAccount = !account?.exists
  const needsFunding = account?.exists && account?.needsTopUp
  const isReady = account?.exists && !account?.needsTopUp

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {needsAccount && <Wallet className="h-5 w-5 text-blue-500" />}
            {needsFunding && <CreditCard className="h-5 w-5 text-orange-500" />}
            {isReady && <CheckCircle className="h-5 w-5 text-green-500" />}
            
            {needsAccount && "Create Fine-tuning Account"}
            {needsFunding && "Fund Your Account"}
            {isReady && "Account Ready"}
          </DialogTitle>
          
          <DialogDescription>
            {needsAccount && "Welcome! To use fine-tuning, you'll need to create a compute account with a small deposit."}
            {needsFunding && "Your account needs additional funding to proceed with fine-tuning."}
            {isReady && "Your fine-tuning account is ready to use!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Status Display */}
          {account && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Balance</span>
                <span className="text-lg font-bold">
                  {account.balance} OG
                </span>
              </div>
              
              {account.needsTopUp && (
                <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
                  Minimum required: {account.minRequired} OG
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Deposit Amount Input */}
          {(needsAccount || needsFunding) && (
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">
                {needsAccount ? "Initial Deposit" : "Deposit Amount"} (OG)
              </Label>
              <Input
                id="deposit-amount"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="0.001"
                max="10"
                step="0.001"
                placeholder="0.01"
                disabled={actionLoading || loading}
              />
              <div className="text-xs text-gray-500 space-y-1">
                <div>• Minimum: 0.001 OG for basic operations</div>
                <div>• Recommended: 0.01 OG (~100 fine-tuning tasks)</div>
                <div>• Maximum: 10 OG per transaction</div>
              </div>
            </div>
          )}

          {/* Quick Amount Buttons */}
          {(needsAccount || needsFunding) && (
            <div className="space-y-2">
              <Label>Quick amounts:</Label>
              <div className="flex gap-2">
                {['0.01', '0.05', '0.1', '0.5'].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(amount)}
                    disabled={actionLoading || loading}
                  >
                    {amount} OG
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Information Box */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {needsAccount && "This transaction will be paid from your connected wallet. The deposited amount will be available for fine-tuning operations."}
              {needsFunding && "Additional funds will be added to your existing fine-tuning account balance."}
              {isReady && "You can now start fine-tuning AI models! Your account has sufficient balance for operations."}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={actionLoading || loading}
          >
            {isReady ? "Close" : "Cancel"}
          </Button>
          
          {needsAccount && (
            <Button
              onClick={handleCreateAccount}
              disabled={actionLoading || loading || parseFloat(depositAmount) <= 0}
            >
              {actionLoading || loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          )}
          
          {needsFunding && (
            <Button
              onClick={handleAddFunds}
              disabled={actionLoading || loading || parseFloat(depositAmount) <= 0}
            >
              {actionLoading || loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Funds...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Funds
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}