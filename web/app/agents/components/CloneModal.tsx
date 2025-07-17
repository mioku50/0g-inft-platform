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
import { Loader2, Copy, Sparkles, Shield } from 'lucide-react'
import { ethers } from 'ethers'

interface CloneModalProps {
  agent: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

// ABI для новых контрактов
const AGENT_NFT_ABI = [
  {
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_tokenId", "type": "uint256" },
      {
        "name": "_proofs",
        "type": "tuple[]",
        "components": [
          { "name": "oldDataHash", "type": "bytes32" },
          { "name": "newDataHash", "type": "bytes32" },
          { "name": "sealedKey", "type": "bytes" },
          { "name": "proof", "type": "bytes" }
        ]
      }
    ],
    "name": "iClone",
    "outputs": [{ "name": "_newTokenId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const

export function CloneModal({ agent, isOpen, onClose, onSuccess }: CloneModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [cloneName, setCloneName] = useState('')
  const [cloneDescription, setCloneDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'generating-proof' | 'cloning'>('input')
  const [useNewContract, setUseNewContract] = useState(false)

  const oldContractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`
  const newContractAddress = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS as `0x${string}`

  const handleCloneOldContract = async () => {
    try {
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
        description: cloneDescription || `Clone of ${originalMetadata.name || agent.name}`,
        model: originalMetadata.model || agent.model || 'llama-3.3-70b',
        originalTokenId: agent.tokenId,
        clonedAt: new Date().toISOString(),
        isClone: true
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
      const INFT_ABI = [
        {
          "inputs": [
            { "name": "to", "type": "address" },
            { "name": "_metadataHash", "type": "string" },
            { "name": "_dataHashes", "type": "bytes32" },
            { "name": "_sealedKey", "type": "bytes32" }
          ],
          "name": "mint",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ]

      const tx = await walletClient!.writeContract({
        address: oldContractAddress,
        abi: INFT_ABI,
        functionName: 'mint',
        args: [
          address as `0x${string}`,
          newMetadataHash,
          ethers.keccak256(ethers.toUtf8Bytes(cloneName + Date.now())),
          ethers.keccak256(ethers.toUtf8Bytes('decryption-key'))
        ]
      })

      await publicClient!.waitForTransactionReceipt({ hash: tx })
      
      return true
    } catch (err) {
      throw err
    }
  }

  const handleCloneNewContract = async () => {
    try {
      setStep('generating-proof')
      
      // Генерируем proof через 0G Compute TEE
      const proofResponse = await fetch('/api/tee/generate-clone-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: agent.tokenId,
          owner: address,
          cloneName: cloneName,
          cloneDescription: cloneDescription || `Clone of ${agent.name}`,
          oldDataHash: agent.metadataHash || ethers.keccak256(ethers.toUtf8Bytes(agent.metadata?.name || ''))
        }),
      })

      if (!proofResponse.ok) {
        throw new Error('Failed to generate TEE proof')
      }

      const { proof, teeVerified } = await proofResponse.json()
      
      console.log('TEE proof generated:', { teeVerified })
      
      setStep('cloning')
      
      // Вызываем iClone с TEE proof
      const tx = await walletClient!.writeContract({
        address: newContractAddress,
        abi: AGENT_NFT_ABI,
        functionName: 'iClone',
        args: [
          address as `0x${string}`,
          BigInt(agent.tokenId),
          [proof] // Массив из одного proof
        ]
      })
      
      await publicClient!.waitForTransactionReceipt({ hash: tx })
      
      return true
    } catch (err) {
      throw err
    }
  }

  const handleClone = async () => {
    if (!cloneName || !walletClient || !agent) return

    try {
      setLoading(true)
      setError('')

      if (useNewContract && newContractAddress) {
        await handleCloneNewContract()
        toast({
          title: 'Success!',
          description: `Clone "${cloneName}" created with TEE verification`
        })
      } else {
        await handleCloneOldContract()
        toast({
          title: 'Success!',
          description: `Clone "${cloneName}" created successfully`
        })
      }
      
      onSuccess()
    } catch (err: any) {
      console.error('Clone error:', err)
      setError(err.message || 'Clone failed')
      setStep('input')
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
            Create a copy of "{agent?.name || agent?.metadata?.name}" with a new identity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'input' && (
            <>
              <div>
                <Label htmlFor="cloneName">Clone Name</Label>
                <Input
                  id="cloneName"
                  placeholder={`${agent?.name || agent?.metadata?.name} Clone`}
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
                  placeholder={`Clone of ${agent?.name || agent?.metadata?.name}`}
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  disabled={loading}
                  rows={3}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              {newContractAddress && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useNewContract"
                    checked={useNewContract}
                    onChange={(e) => setUseNewContract(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useNewContract" className="text-sm">
                    Use ERC7857 contract with TEE (experimental)
                  </Label>
                </div>
              )}

              <Alert className={useNewContract ? "bg-purple-900/30 border-purple-500/30" : "bg-blue-900/30 border-blue-500/30"}>
                {useNewContract ? <Shield className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                <AlertDescription className={useNewContract ? "text-purple-300" : "text-blue-300"}>
                  {useNewContract 
                    ? "Clone with TEE verification - secure metadata duplication"
                    : "Standard clone - creates a copy with same capabilities"}
                </AlertDescription>
              </Alert>
            </>
          )}

          {step === 'generating-proof' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-300">Generating TEE proof for cloning...</p>
              <p className="text-sm text-gray-500 mt-2">Secure metadata duplication</p>
            </div>
          )}

          {step === 'cloning' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-300">Creating clone on blockchain...</p>
              <p className="text-sm text-gray-500 mt-2">Minting new NFT</p>
            </div>
          )}

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