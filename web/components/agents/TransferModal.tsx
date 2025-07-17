// web/components/agents/TransferModal.tsx
import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ethers } from 'ethers'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Send, AlertCircle } from 'lucide-react'
import { INFT_ABI } from '@/lib/contracts/abis'

interface TransferModalProps {
  agent: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function TransferModal({ agent, isOpen, onClose, onSuccess }: TransferModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  const handleTransfer = async () => {
    if (!recipientAddress || !walletClient || !agent) return

    try {
      setLoading(true)
      setError('')

      // Используем стандартный transferFrom который работает
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'transferFrom',
        args: [
          address as `0x${string}`,
          recipientAddress as `0x${string}`,
          BigInt(agent.tokenId)
        ]
      })
      
      await publicClient.waitForTransactionReceipt({ hash: tx })

      toast({
        title: 'Success!',
        description: 'Agent transferred successfully'
      })
      
      onSuccess()
    } catch (err: any) {
      console.error('Transfer error:', err)
      setError(err.message || 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Transfer Agent</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfer your AI agent "{agent?.metadata?.name}" to another address.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={loading}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <Alert className="bg-yellow-900/30 border-yellow-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-yellow-300">
              ⚠️ Make sure the recipient address is correct. This action cannot be undone.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-500/30">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
              className="bg-gray-800 border-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={loading || !recipientAddress || !ethers.isAddress(recipientAddress)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Transfer Agent
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}