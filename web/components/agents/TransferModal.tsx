// web/components/agents/TransferModal.tsx
import { useState } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
// ... другие импорты ...

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
    "name": "iTransfer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const

export function TransferModal({ agent, isOpen, onClose, onSuccess }: TransferModalProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const [recipientAddress, setRecipientAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'input' | 'generating-proof' | 'transferring'>('input')

  const contractAddress = process.env.NEXT_PUBLIC_AGENT_NFT_ADDRESS as `0x${string}`

  const handleTransfer = async () => {
    if (!recipientAddress || !walletClient || !agent) return

    try {
      setLoading(true)
      setError('')
      setStep('generating-proof')

      // Генерируем proof через 0G Compute TEE
      const proofResponse = await fetch('/api/tee/generate-transfer-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: agent.tokenId,
          from: address,
          to: recipientAddress,
          oldDataHash: agent.metadataHash || ethers.keccak256(ethers.toUtf8Bytes(agent.metadata?.name || ''))
        }),
      })

      if (!proofResponse.ok) {
        throw new Error('Failed to generate TEE proof')
      }

      const { proof, teeVerified, provider, model } = await proofResponse.json()
      
      console.log('TEE proof generated:', { teeVerified, provider, model })
      
      setStep('transferring')
      
      // Вызываем iTransfer с TEE proof
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: AGENT_NFT_ABI,
        functionName: 'iTransfer',
        args: [
          recipientAddress as `0x${string}`,
          BigInt(agent.tokenId),
          [proof] // Массив из одного TransferValidityProof
        ]
      })
      
      await publicClient.waitForTransactionReceipt({ hash: tx })

      toast({
        title: 'Success!',
        description: `Agent transferred with TEE verification via ${model}`,
        variant: 'success'
      })
      
      onSuccess()
    } catch (err: any) {
      console.error('Transfer error:', err)
      setError(err.message || 'Transfer failed')
      setStep('input')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle>Secure Transfer with TEE</DialogTitle>
          <DialogDescription className="text-gray-400">
            Transfer your AI agent "{agent?.metadata?.name}" with cryptographic proof of secure data re-encryption.
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
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <Alert className="bg-purple-900/30 border-purple-500/30">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-purple-300">
                  This transfer uses 0G Compute TEE (phala/deepseek) to securely re-encrypt your agent's data for the new owner.
                </AlertDescription>
              </Alert>
            </>
          )}

          {step === 'generating-proof' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-300">Generating TEE proof via 0G Compute...</p>
              <p className="text-sm text-gray-500 mt-2">Secure re-encryption in progress</p>
            </div>
          )}

          {step === 'transferring' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-300">Executing transfer on blockchain...</p>
              <p className="text-sm text-gray-500 mt-2">Confirming transaction</p>
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
              onClick={handleTransfer} 
              disabled={loading || !recipientAddress || !ethers.isAddress(recipientAddress)}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Transfer with TEE
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}