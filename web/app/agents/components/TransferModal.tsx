// web/components/agents/TransferModal.tsx
import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { INFT_ABI } from '@/lib/contracts/abis'
import { ethers } from 'ethers'

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
  const [step, setStep] = useState('input') // input, encrypting, transferring

  const contractAddress = '0x500AF12C3Fd7aF1665DC85Eff9844054709dF380'

  const handleTransfer = async () => {
    if (!recipientAddress || !walletClient || !agent) return

    try {
      setLoading(true)
      setError('')
      setStep('encrypting')

      // Шаг 1: Получаем метаданные из 0G Storage
      const metadataResponse = await fetch('/api/storage/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootHash: agent.metadataHash }),
      })
      
      if (!metadataResponse.ok) throw new Error('Failed to retrieve metadata')
      
      const { content: metadataJson } = await metadataResponse.json()
      const metadata = JSON.parse(metadataJson)

      // Шаг 2: Используем TEE для перешифровки метаданных
      const teeResponse = await fetch('/api/tee/re-encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalData: metadata,
          oldOwner: address,
          newOwner: recipientAddress,
          tokenId: agent.tokenId
        }),
      })

      if (!teeResponse.ok) throw new Error('TEE re-encryption failed')

      const { newMetadataHash, encryptedKey, proof } = await teeResponse.json()

      // Шаг 3: Загружаем новые зашифрованные метаданные в 0G Storage
      const uploadResponse = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: JSON.stringify({
            ...metadata,
            encryptedFor: recipientAddress,
            transferredFrom: address,
            transferredAt: new Date().toISOString()
          }),
          encrypt: true,
          recipientKey: recipientAddress
        }),
      })

      if (!uploadResponse.ok) throw new Error('Failed to upload re-encrypted metadata')

      setStep('transferring')

      // Шаг 4: Вызываем transferWithMetadata в контракте
      const { request } = await publicClient.simulateContract({
        address: contractAddress as `0x${string}`,
        abi: INFT_ABI,
        functionName: 'transferWithMetadata',
        args: [
          address as `0x${string}`,
          recipientAddress as `0x${string}`,
          BigInt(agent.tokenId),
          newMetadataHash,
          encryptedKey,
          proof
        ],
        account: address as `0x${string}`,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash })

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Agent</DialogTitle>
          <DialogDescription>
            Transfer your AI agent "{agent?.name}" to another address. The agent's private data will be securely re-encrypted for the new owner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'input' && (
            <>
              <div>
                <Label htmlFor="recipient">Recipient Address</Label>
                <Input
                  id="recipient"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Alert>
                <AlertDescription>
                  ⚡ This transfer uses TEE (Trusted Execution Environment) to securely re-encrypt the agent's data for the new owner.
                </AlertDescription>
              </Alert>
            </>
          )}

          {step === 'encrypting' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Re-encrypting agent data with TEE...</p>
            </div>
          )}

          {step === 'transferring' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Transferring agent on blockchain...</p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={loading || !recipientAddress || !ethers.isAddress(recipientAddress)}
            >
              {loading ? 'Processing...' : 'Transfer Agent'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}