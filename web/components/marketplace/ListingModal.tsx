import { useState } from 'react'
import { useContractWrite, useWaitForTransaction } from 'wagmi'
import { parseEther } from 'viem'
import { NATIVE_SYMBOL } from '@/lib/constants'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ShoppingCart, TrendingUp } from 'lucide-react'
import { AGENT_MARKETPLACE_ABI } from '@/lib/contracts/abis'

interface ListingModalProps {
  tokenId: string
  agentName: string
  onClose: () => void
  onSuccess: () => void
}

export function ListingModal({ tokenId, agentName, onClose, onSuccess }: ListingModalProps) {
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const { toast } = useToast()

  const { write: listAgent, data: listData } = useContractWrite({
    address: process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`,
    abi: AGENT_MARKETPLACE_ABI,
    functionName: 'listAgent' as any,
  })

  const { isLoading: isListing } = useWaitForTransaction({
    hash: listData?.hash,
    onSuccess() {
      toast({
        title: 'Listed Successfully!',
        description: 'Your AI agent is now available on the marketplace',
      })
      onSuccess()
    },
  })

  const handleList = async () => {
    if (!price || parseFloat(price) <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price greater than 0',
        variant: 'destructive',
      })
      return
    }

    try {
      const priceInWei = parseEther(price)
      
      listAgent({
        args: [BigInt(tokenId), priceInWei],
      })
    } catch (error) {
      console.error('Listing error:', error)
      toast({
        title: 'Listing Failed',
        description: 'An error occurred while listing your agent',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>List {agentName} on Marketplace</DialogTitle>
          <DialogDescription>
            Set a price and description for your AI agent listing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="price">
              Price ({NATIVE_SYMBOL})
              <span className="text-xs text-gray-400 ml-2">
                Marketplace fee: 2.5%
              </span>
            </Label>
            <div className="relative">
              <Input
                id="price"
                type="number"
                step="0.001"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {NATIVE_SYMBOL}
              </span>
            </div>
            {price && (
              <p className="text-sm text-gray-400">
                You'll receive: {(parseFloat(price) * 0.975).toFixed(4)} {NATIVE_SYMBOL} after fees
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Listing Description (Optional)
              <span className="text-xs text-gray-400 ml-2">
                Help buyers understand your agent's value
              </span>
            </Label>
            <Textarea
              id="description"
              placeholder="Highlight unique features, performance metrics, or use cases..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Pricing Tips
            </h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Similar agents are priced between 0.01 - 0.05 {NATIVE_SYMBOL}</li>
              <li>• Consider your agent's unique capabilities</li>
              <li>• You can adjust the price later</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isListing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleList}
            disabled={!price || isListing}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isListing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Listing...
              </>
            ) : (
              <>
                <ShoppingCart className="mr-2 h-4 w-4" />
                List on Marketplace
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===================================