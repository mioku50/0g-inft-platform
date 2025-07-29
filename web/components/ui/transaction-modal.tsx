'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, Check, AlertCircle, ExternalLink } from 'lucide-react'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  amount?: string
  symbol?: string
  onConfirm: () => Promise<void>
  isLoading?: boolean
  txHash?: string
  error?: string
}

export function TransactionModal({
  isOpen,
  onClose,
  title,
  description,
  amount,
  symbol = 'OG',
  onConfirm,
  isLoading = false,
  txHash,
  error
}: TransactionModalProps) {
  const [step, setStep] = useState<'confirm' | 'signing' | 'success' | 'error'>('confirm')

  const handleConfirm = async () => {
    try {
      setStep('signing')
      await onConfirm()
      setStep('success')
    } catch (err) {
      setStep('error')
    }
  }

  const handleClose = () => {
    setStep('confirm')
    onClose()
  }

  const getTxUrl = (hash: string) => {
    return `https://explorer-testnet.0g.ai/tx/${hash}`
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
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

        <div className="space-y-4">
          {/* Amount Display */}
          {amount && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{amount} {symbol}</div>
                <div className="text-sm text-muted-foreground">Transaction Amount</div>
              </div>
            </div>
          )}

          {/* Status Display */}
          {step === 'confirm' && (
            <Alert>
              <Wallet className="h-4 w-4" />
              <AlertDescription>
                Please confirm this transaction in your wallet to proceed.
              </AlertDescription>
            </Alert>
          )}

          {step === 'signing' && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Transaction is being processed. Please wait...
              </AlertDescription>
            </Alert>
          )}

          {step === 'success' && txHash && (
            <Alert className="border-green-200 bg-green-50">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Transaction successful! 
                <a 
                  href={getTxUrl(txHash)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                >
                  View on Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}

          {step === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Transaction failed. Please try again.'}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            {step === 'confirm' && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Transaction
                </Button>
              </>
            )}

            {step === 'signing' && (
              <Button disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </Button>
            )}

            {(step === 'success' || step === 'error') && (
              <Button onClick={handleClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}