// web/components/agents/CloneModal.tsx
import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Copy, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'

interface CloneModalProps {
  agent: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CloneModal({ agent, isOpen, onClose, onSuccess }: CloneModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [cloneName, setCloneName] = useState('')
  const [cloneDescription, setCloneDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  const handleClone = async () => {
    if (!cloneName || !walletClient || !agent) return

    try {
      setLoading(true)
      setError('')

      // Получаем оригинальные метаданные
      let originalMetadata = agent.metadata || {}
      
      if (agent.metadataHash) {
        try {
          const metadataResponse = await fetch('/api/storage/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootHash: agent.metadataHash }),
          })
          
          if (metadataResponse.ok) {
            const { content: metadataJson } = await metadataResponse.json()
            originalMetadata = JSON.parse(metadataJson)
          }
        } catch (e) {
          console.error('Failed to retrieve metadata:', e)
        }
      }

      // Создаем новые метаданные для клона
      const cloneMetadata = {
        ...originalMetadata,
        name: cloneName,
        description: cloneDescription || `Clone of ${originalMetadata.name}`,
        model: originalMetadata.model || 'llama-3.3-70b',
        originalTokenId: agent.tokenId,
        clonedAt: new Date().toISOString(),
        isClone: true,
        capabilities: originalMetadata.capabilities || agent.metadata?.capabilities,
        systemPrompt: originalMetadata.systemPrompt || agent.metadata?.systemPrompt
      }

      // Загружаем новые метаданные в 0G Storage
      const uploadResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: JSON.stringify(cloneMetadata)
        }),
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload clone metadata')
      }
      
      const { rootHash: newMetadataHash } = await uploadResponse.json()

      // Минтим через старый контракт
      const tx = await (walletClient as any).writeContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'mint',
        args: [
          address as `0x${string}`,
          newMetadataHash,
          ethers.keccak256(ethers.toUtf8Bytes(cloneName + Date.now())) as `0x${string}`,
          ethers.keccak256(ethers.toUtf8Bytes('decryption-key'))
        ] as any
      })

      await publicClient.waitForTransactionReceipt({ hash: tx })
      
      toast({
        title: 'Success!',
        description: `Clone "${cloneName}" created successfully`
      })
      
      onSuccess()
    } catch (err: any) {
      console.error('Clone error:', err)
      setError(err.message || 'Clone failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Clone Agent</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a copy of "{agent?.metadata?.name}" with a new identity. The clone will inherit all capabilities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="cloneName">Clone Name</Label>
            <Input
              id="cloneName"
              placeholder={`${agent?.metadata?.name} Clone`}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              disabled={loading}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div>
            <Label htmlFor="cloneDescription">Clone Description (Optional)</Label>
            <Textarea
              id="cloneDescription"
              placeholder={`Clone of ${agent?.metadata?.name}`}
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              disabled={loading}
              rows={3}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <Alert className="bg-purple-900/30 border-purple-500/30">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="text-purple-300">
              The clone will inherit the AI model and capabilities but will have its own unique identity and token ID.
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
              onClick={handleClone} 
              disabled={loading || !cloneName}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Clone...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Create Clone
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}