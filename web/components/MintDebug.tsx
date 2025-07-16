'use client'

import { useState } from 'react'
import { useAccount, useContractWrite, useWaitForTransaction, useBalance, useNetwork } from 'wagmi'
import { parseEther } from 'viem'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, AlertCircle } from 'lucide-react'

const SIMPLE_MINT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "string", "name": "encryptedURI", "type": "string"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"}
    ],
    "name": "mint",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  }
] as const

export function MintDebug() {
  const { address, isConnected } = useAccount()
  const { chain } = useNetwork()
  const { data: balance } = useBalance({ address })
  const [status, setStatus] = useState<string>('')
  
  const { 
    write: mint, 
    data: mintData,
    isLoading: isWriteLoading,
    error: writeError,
    isError: hasWriteError
  } = useContractWrite({
    address: process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: SIMPLE_MINT_ABI,
    functionName: 'mint',
  })

  const { 
    isLoading: isTxLoading, 
    isSuccess: isTxSuccess,
    error: txError
  } = useWaitForTransaction({
    hash: mintData?.hash,
  })

  const handleTestMint = async () => {
    if (!address) return
    
    setStatus('Preparing mint transaction...')
    
    const testData = {
      to: address,
      encryptedURI: '0g://storage/test-uri-' + Date.now(),
      metadataHash: `0x${'a'.repeat(64)}` as `0x${string}`, // Dummy hash
      value: parseEther('0.01')
    }
    
    console.log('Mint params:', testData)
    
    try {
      mint({
        args: [testData.to, testData.encryptedURI, testData.metadataHash],
        value: testData.value
      })
      setStatus('Please confirm in wallet...')
    } catch (error) {
      console.error('Mint error:', error)
      setStatus('Error: ' + (error as any).message)
    }
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle>🔧 Mint Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Info */}
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Connected:</span>{' '}
            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? 'Yes' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Network:</span>{' '}
            <span className={chain?.id === 16601 ? 'text-green-400' : 'text-yellow-400'}>
              {chain?.name || 'Not connected'} (ID: {chain?.id})
            </span>
          </div>
          <div>
            <span className="text-gray-400">Address:</span>{' '}
            <span className="font-mono text-xs">{address || 'Not connected'}</span>
          </div>
          <div>
            <span className="text-gray-400">Balance:</span>{' '}
            <span>{balance ? `${balance.formatted} ${balance.symbol}` : 'Loading...'}</span>
          </div>
          <div>
            <span className="text-gray-400">Contract:</span>{' '}
            <span className="font-mono text-xs">
              {process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS || 'Not configured'}
            </span>
          </div>
        </div>

        {/* Errors */}
        {hasWriteError && (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400">Write Error:</p>
                <p className="text-red-300">{writeError?.message}</p>
              </div>
            </div>
          </div>
        )}

        {txError && (
          <div className="p-3 bg-red-900/20 border border-red-700 rounded text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-400">Transaction Error:</p>
                <p className="text-red-300">{txError.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Info */}
        {mintData && (
          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded text-sm">
            <p className="text-blue-400">Transaction Hash:</p>
            <p className="font-mono text-xs break-all">{mintData.hash}</p>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="text-sm text-gray-300">{status}</div>
        )}

        {/* Success */}
        {isTxSuccess && (
          <div className="p-3 bg-green-900/20 border border-green-700 rounded text-sm">
            <p className="text-green-400">✅ Mint successful!</p>
          </div>
        )}

        {/* Test Button */}
        <Button
          onClick={handleTestMint}
          disabled={!isConnected || isWriteLoading || isTxLoading || chain?.id !== 16601}
          className="w-full"
        >
          {isWriteLoading || isTxLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isWriteLoading ? 'Preparing...' : 'Processing...'}
            </>
          ) : (
            'Test Mint (0.01 A0GI)'
          )}
        </Button>

        {chain?.id !== 16601 && isConnected && (
          <p className="text-yellow-400 text-sm text-center">
            Please switch to 0G Testnet (Chain ID: 16601)
          </p>
        )}
      </CardContent>
    </Card>
  )
}