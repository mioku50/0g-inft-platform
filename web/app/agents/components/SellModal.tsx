// web/app/agents/components/SellModal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWalletClient } from 'wagmi'
import { parseEther } from 'viem'
import { INFT_ABI, AGENT_MARKETPLACE_ABI } from '@/lib/contracts/abis'
import { toast } from '@/components/ui/use-toast'

interface SellModalProps {
  isOpen: boolean
  onClose: () => void
  agent: {
    tokenId: string
    name: string
    model: string
  }
  onSuccess: () => void
}

export function SellModal({ isOpen, onClose, agent, onSuccess }: SellModalProps) {
  const { data: walletClient } = useWalletClient()
  const [price, setPrice] = useState('0.001')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'approve' | 'list'>('approve')

  const nftAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`
  const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`

  const handleList = async () => {
    if (!walletClient) return
    
    setLoading(true)
    
    try {
      // Step 1: Check if already approved
      const isApproved = await walletClient.readContract({
        address: nftAddress,
        abi: INFT_ABI,
        functionName: 'isApprovedForAll',
        args: [walletClient.account.address, marketplaceAddress]
      })
      
      console.log('Is approved:', isApproved)
      
      // Step 2: Approve if needed
      if (!isApproved) {
        console.log('Approving marketplace...')
        setStep('approve')
        
        const approveTx = await walletClient.writeContract({
          address: nftAddress,
          abi: INFT_ABI,
          functionName: 'setApprovalForAll',
          args: [marketplaceAddress, true],
          account: walletClient.account,
        })
        
        console.log('Approve tx:', approveTx)
        
        // Wait for approval
        const receipt = await walletClient.waitForTransactionReceipt({ hash: approveTx })
        console.log('Approve receipt:', receipt)
        
        if (receipt.status !== 'success') {
          throw new Error('Approval failed')
        }
        
        toast({
          title: 'Approval Successful',
          description: 'Now listing your agent...',
        })
      }
      
      // Step 3: List the agent
      console.log('Listing agent...')
      setStep('list')
      
      const priceInWei = parseEther(price)
      console.log('Price in wei:', priceInWei.toString())
      console.log('Token ID:', BigInt(agent.tokenId))
      console.log('Marketplace address:', marketplaceAddress)
      
      // Попробуем альтернативный способ вызова
      try {
        // Сначала проверим, что контракт маркетплейса существует
        const code = await walletClient.request({
          method: 'eth_getCode',
          params: [marketplaceAddress, 'latest']
        })
        
        console.log('Marketplace contract code:', code)
        
        if (code === '0x' || !code) {
          throw new Error('Marketplace contract not found at address')
        }
        
        // Теперь пробуем вызвать функцию
        const listTx = await walletClient.writeContract({
          address: marketplaceAddress,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'listAgent',
          args: [BigInt(agent.tokenId), priceInWei],
          account: walletClient.account,
          // Добавляем газ вручную
          gas: BigInt(300000),
        })
        
        console.log('List tx:', listTx)
        
        const listReceipt = await walletClient.waitForTransactionReceipt({ hash: listTx })
        console.log('List receipt:', listReceipt)
        
        if (listReceipt.status !== 'success') {
          throw new Error('Listing transaction failed')
        }
        
        toast({
          title: 'Success!',
          description: `${agent.name} is now listed for ${price} OG`,
        })
        
        onSuccess()
        onClose()
        
      } catch (listError: any) {
        console.error('List error details:', listError)
        
        // Более детальная диагностика
        if (listError.message?.includes('execution reverted')) {
          throw new Error('Transaction reverted. The marketplace contract might require specific conditions.')
        } else if (listError.message?.includes('user rejected')) {
          throw new Error('Transaction was rejected')
        } else {
          throw new Error(`Listing failed: ${listError.message || 'Unknown error'}`)
        }
      }
      
    } catch (error: any) {
      console.error('Full error:', error)
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to list agent',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
      setStep('approve')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white">
            List {agent.name} for Sale
          </DialogTitle>
          <p className="text-gray-400">
            Set your price in OG tokens. The agent will be listed on the marketplace.
          </p>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2">{agent.name}</h3>
            <p className="text-gray-400 text-sm">{agent.model}</p>
            <div className="flex gap-2 mt-2">
              <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                Token #{agent.tokenId}
              </span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                {agent.model.split('-')[0]}
              </span>
            </div>
          </div>
          
          <div>
            <Label htmlFor="price" className="text-white mb-2 block">
              Price (OG)
            </Label>
            <Input
              id="price"
              type="number"
              step="0.001"
              min="0.001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
              placeholder="0.001"
            />
            <p className="text-gray-400 text-sm mt-2">
              Minimum price: 0.001 OG
            </p>
          </div>
          
          {loading && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                {step === 'approve' ? 'Waiting for approval...' : 'Listing your agent...'}
              </p>
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleList}
              disabled={loading || !price || parseFloat(price) < 0.001}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
            >
              {loading ? (
                step === 'approve' ? 'Approving...' : 'Listing...'
              ) : (
                'List for Sale'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}