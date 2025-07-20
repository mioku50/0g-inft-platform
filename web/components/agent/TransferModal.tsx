import { useState } from 'react'
import { useContractWrite, useWaitForTransaction } from 'wagmi'
import { isAddress } from 'viem'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'

interface TransferModalProps {
  tokenId: string
  onClose: () => void
  onSuccess: () => void
}

export function TransferModal({ tokenId, onClose, onSuccess }: TransferModalProps) {
  const [recipient, setRecipient] = useState('')
  const [recipientPublicKey, setRecipientPublicKey] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const { toast } = useToast()

  const { write: transfer, data: transferData } = useContractWrite({
    address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: INFT_ABI,
    functionName: 'secureTransfer' as any,
  })

  const { isLoading: isTransferring } = useWaitForTransaction({
    hash: transferData?.hash,
    onSuccess() {
      toast({
        title: 'Transfer Successful!',
        description: 'Your AI agent has been transferred to the new owner',
      })
      onSuccess()
    },
  })

  const handleTransfer = async () => {
    if (!isAddress(recipient)) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid Ethereum address',
        variant: 'destructive',
      })
      return
    }

    setIsValidating(true)
    try {
      // In production, prepare transfer with oracle
      // For demo, simulate the process
      const mockSealedKey = '0x' + '00'.repeat(32)
      const mockProof = '0x' + '00'.repeat(64)

      transfer({
        args: [
          recipient,
          recipient,
          BigInt(tokenId),
          mockSealedKey,
          mockProof,
        ],
      })
    } catch (error) {
      console.error('Transfer error:', error)
      toast({
        title: 'Transfer Failed',
        description: 'An error occurred during transfer preparation',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer AI Agent</DialogTitle>
          <DialogDescription>
            Transfer ownership of your AI agent to another address. The agent's data will be automatically re-encrypted for the new owner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action is irreversible. Make sure you trust the recipient and have entered the correct address.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="publicKey">
              Recipient's Public Key (Optional)
              <span className="text-xs text-gray-400 ml-2">
                For enhanced security
              </span>
            </Label>
            <Input
              id="publicKey"
              placeholder="Optional: Recipient's encryption public key"
              value={recipientPublicKey}
              onChange={(e) => setRecipientPublicKey(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isValidating || isTransferring}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!recipient || isValidating || isTransferring}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isValidating || isTransferring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isValidating ? 'Validating...' : 'Transferring...'}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Transfer Agent
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===================================