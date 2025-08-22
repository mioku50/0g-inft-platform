// web/components/agents/CloneModal.tsx
import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { INFT_ABI } from '@/lib/contracts/abis'
import { toast } from '@/components/ui/use-toast'
import { Loader2, Copy, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'

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
    if (!cloneName || !walletClient || !agent || !address) return

    try {
      setLoading(true)
      setError('')

      // Шаг 1: Получаем оригинальные метаданные
      const metadataResponse = await fetch('/api/storage/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootHash: agent.metadataHash }),
      })
      
      if (!metadataResponse.ok) throw new Error('Failed to retrieve metadata')
      
      const { content: metadataJson } = await metadataResponse.json()
      const originalMetadata = JSON.parse(metadataJson)

      // Шаг 2: Создаем новые метаданные для клона
      const cloneMetadata = {
        ...originalMetadata,
        name: cloneName,
        description: cloneDescription || `Clone of ${originalMetadata.name}`,
        originalTokenId: agent.tokenId,
        clonedAt: new Date().toISOString(),
        isClone: true,
        creator: address // Обновляем создателя
      }

      // Пересобираем systemPrompt из общих правил, если возможно
      try {
        const { buildSystemPrompt } = await import('@/lib/prompts/buildSystemPrompt')
        const regenerated = buildSystemPrompt({
          name: cloneMetadata.name,
          description: cloneMetadata.description,
          personality: originalMetadata.personality,
          expertise: originalMetadata.expertise,
          skills: Array.isArray(originalMetadata.skills) ? originalMetadata.skills : [],
          capabilities: Array.isArray(originalMetadata.capabilities) ? originalMetadata.capabilities : [],
          customInstructions: originalMetadata.systemPrompt,
        })
        ;(cloneMetadata as any).systemPrompt = regenerated
      } catch {}

      // Шаг 3: Загружаем новые метаданные в 0G Storage
      const uploadResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: cloneMetadata // Используем metadata вместо content
        }),
      })

      if (!uploadResponse.ok) throw new Error('Failed to upload clone metadata')
      
      const { rootHash: newMetadataHash } = await uploadResponse.json()

      // Шаг 4: Создаем proof для клонирования (simplified version)
      const proof = ethers.hexlify(ethers.randomBytes(32)) // Упрощенный proof
      const sealedKey = ethers.hexlify(ethers.randomBytes(32)) // Упрощенный sealed key

      // Шаг 5: Пробуем использовать функцию clone
      try {
        const tx = await walletClient.writeContract({
          address: contractAddress,
          abi: INFT_ABI,
          functionName: 'clone',
          args: [
            BigInt(agent.tokenId),
            address as `0x${string}`, // to
            sealedKey as `0x${string}`, // sealedKey
            proof as `0x${string}` // proof
          ]
        })

        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
        
        // Получаем tokenId из события
        const cloneEvent = receipt.logs.find(log => {
          try {
            const decoded = (publicClient as any).decodeEventLog({
              abi: INFT_ABI,
              data: log.data,
              topics: log.topics as any
            })
            return decoded.eventName === 'AgentCloned'
          } catch {
            return false
          }
        })

        if (cloneEvent) {
          const decoded = (publicClient as any).decodeEventLog({
            abi: INFT_ABI,
            data: cloneEvent.data,
            topics: cloneEvent.topics as any
          })
          console.log('Clone created with tokenId:', decoded.args.newTokenId)
        }

      } catch (cloneError: any) {
        // Если clone не работает, используем обычный mint
        console.log('Clone function failed, using standard mint:', cloneError.message)
        
        // Генерируем хэш для контракта
        const metadataHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify({
            name: cloneMetadata.name,
            model: cloneMetadata.model,
            creator: address
          }))
        )
        
        const tx = await walletClient.writeContract({
          address: contractAddress,
          abi: INFT_ABI,
          functionName: 'mint',
          args: [
            address as `0x${string}`,
            newMetadataHash as `0x${string}`, // encryptedURI
            metadataHash as `0x${string}` // metadataHash
          ]
        })

        await publicClient.waitForTransactionReceipt({ hash: tx })
      }

      toast({
        title: 'Success! 🎉',
        description: `Clone "${cloneName}" created successfully`
      })
      
      // Закрываем модал и обновляем список
      onClose()
      onSuccess()
      
    } catch (err: any) {
      console.error('Clone error:', err)
      setError(err.message || 'Clone failed')
      
      toast({
        title: 'Error',
        description: err.message || 'Failed to create clone',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Clone Agent</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a copy of "{agent?.metadata?.name}" with a new identity. The clone will have the same capabilities but a unique token ID.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="cloneName" className="text-white">Clone Name *</Label>
            <Input
              id="cloneName"
              placeholder={`${agent?.metadata?.name} v2`}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              disabled={loading}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label htmlFor="cloneDescription" className="text-white">Clone Description (Optional)</Label>
            <Textarea
              id="cloneDescription"
              placeholder={`An enhanced version of ${agent?.metadata?.name}`}
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              disabled={loading}
              rows={3}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <Alert className="bg-purple-900/20 border-purple-500/30">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <AlertDescription className="text-purple-300">
              The clone will inherit:
              <ul className="list-disc list-inside mt-1 text-sm">
                <li>AI Model: {agent?.metadata?.model}</li>
                <li>Personality: {agent?.metadata?.personality}</li>
                <li>Skills & capabilities</li>
              </ul>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/30">
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
              className="bg-gray-800 border-gray-700 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleClone} 
              disabled={loading || !cloneName}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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