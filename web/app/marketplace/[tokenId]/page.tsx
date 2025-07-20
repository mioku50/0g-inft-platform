'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { parseEther, formatEther } from 'viem'
import { ArrowLeft, ShoppingCart, Loader2, AlertCircle, MessageCircle, Zap, Shield, Code } from 'lucide-react'
import Link from 'next/link'
import { INFT_ABI, AGENT_MARKETPLACE_ABI } from '@/lib/contracts/abis'
import { toast } from '@/components/ui/use-toast'

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tokenId = params.tokenId as string
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [showTransferInfo, setShowTransferInfo] = useState(false)
  const [txHash, setTxHash] = useState<string>('')
  
  const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`
  const nftAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  useEffect(() => {
    loadAgentDetails()
  }, [tokenId])

  const loadAgentDetails = async () => {
    try {
      const owner = await publicClient.readContract({
        address: nftAddress,
        abi: INFT_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)]
      })
      
      const metadataHash = await publicClient.readContract({
        address: nftAddress,
        abi: INFT_ABI,
        functionName: 'getEncryptedURI',
        args: [BigInt(tokenId)]
      })
      
      let price = '0.001'
      let isListed = false
      
      try {
        const listingData = await publicClient.readContract({
          address: marketplaceAddress,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [nftAddress, BigInt(tokenId)]
        })
        
        if (listingData && listingData.isActive) {
          price = formatEther(listingData.price)
          isListed = true
        }
      } catch (error) {
        console.log('No active listing')
      }
      
      const response = await fetch('/api/storage/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootHash: metadataHash })
      })
      
      if (response.ok) {
        const data = await response.json()
        const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
        
        setAgent({
          tokenId,
          ...metadata,
          price: price,
          owner: owner,
          isOwner: address?.toLowerCase() === owner.toLowerCase(),
          isListed: isListed
        })
      }
    } catch (error) {
      console.error('Error loading agent:', error)
      setAgent({
        tokenId,
        name: `Agent #${tokenId}`,
        description: 'AI Agent',
        model: 'Unknown',
        price: '0.001',
        owner: '0x0',
        isOwner: false,
        isListed: false
      })
    } finally {
      setLoading(false)
    }
  }

  const purchaseAgent = async () => {
    if (!walletClient || !isConnected || !address) {
      toast({
        title: 'Connect wallet',
        description: 'Please connect your wallet to purchase',
        variant: 'destructive'
      })
      return
    }

    setPurchasing(true)
    
    try {
      if (agent.isListed) {
        // Purchase through marketplace
        const price = parseEther(agent.price.toString())
        
        const tx = await (walletClient as any).writeContract({
          address: marketplaceAddress,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'purchaseItem' as any,
          args: [nftAddress, BigInt(tokenId)],
          value: price
        })
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
        
        if (receipt.status === 'success') {
          toast({
            title: '🎉 Success!',
            description: 'You now own this AI agent!',
          })
          
          setTimeout(() => {
            router.push('/agents')
          }, 2000)
        }
      } else {
        // Direct purchase (manual transfer)
        const currentOwner = await publicClient.readContract({
          address: nftAddress,
          abi: INFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)]
        })
        
        const price = parseEther(agent.price.toString())
        
        const tx = await walletClient.sendTransaction({
          to: currentOwner as `0x${string}`,
          value: price,
        })
        
        setTxHash(tx)
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
        
        if (receipt.status === 'success') {
          toast({
            title: '✅ Payment sent!',
            description: `Successfully sent ${agent.price} OG to the owner`,
          })
          
          setShowTransferInfo(true)
          
          const purchases = JSON.parse(localStorage.getItem('pendingTransfers') || '{}')
          purchases[tokenId] = {
            tokenId,
            buyer: address,
            seller: currentOwner,
            price: price.toString(),
            txHash: tx,
            timestamp: Date.now()
          }
          localStorage.setItem('pendingTransfers', JSON.stringify(purchases))
          
          checkOwnershipStatus(tokenId)
        }
      }
    } catch (error: any) {
      console.error('Purchase error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Purchase failed',
        variant: 'destructive'
      })
    } finally {
      setPurchasing(false)
    }
  }

  const checkOwnershipStatus = async (tokenId: string) => {
    let attempts = 0
    const maxAttempts = 60
    
    const checkInterval = setInterval(async () => {
      attempts++
      
      try {
        const currentOwner = await publicClient.readContract({
          address: nftAddress,
          abi: INFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)]
        })
        
        if (currentOwner.toLowerCase() === address?.toLowerCase()) {
          clearInterval(checkInterval)
          
          toast({
            title: '🎉 Congratulations!',
            description: 'You are now the owner of this AI agent!',
          })
          
          const purchases = JSON.parse(localStorage.getItem('pendingTransfers') || '{}')
          delete purchases[tokenId]
          localStorage.setItem('pendingTransfers', JSON.stringify(purchases))
          
          setTimeout(() => {
            router.push('/agents')
          }, 3000)
        }
      } catch (error) {
        console.log('Checking ownership...', attempts)
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
      }
    }, 5000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Agent not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto py-10 px-4">
        <Link href="/marketplace">
          <Button variant="ghost" className="mb-6 text-white hover:text-purple-300 hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
              <div className="bg-gradient-to-br from-purple-600/40 to-pink-600/40 rounded-2xl p-1">
                <div className="bg-gray-900/90 rounded-xl p-12 backdrop-blur-sm">
                  <img 
                    src={agent.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenId}`}
                    alt={agent.name}
                    className="w-full h-64 object-contain"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <MessageCircle className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="text-sm text-gray-400">Chat</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Code className="w-6 h-6 text-cyan-400" />
                  </div>
                  <p className="text-sm text-gray-400">Analysis</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Shield className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-sm text-gray-400">Verified</p>
                </div>
              </div>
            </div>
            
            {showTransferInfo && (
              <div className="bg-yellow-500/10 backdrop-blur-md rounded-3xl p-6 border border-yellow-500/30">
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">
                  ⚠️ Manual Transfer Required
                </h3>
                
                <div className="space-y-4">
                  <div className="bg-black/30 rounded-xl p-4">
                    <p className="text-sm text-white mb-2">Payment Transaction:</p>
                    <p className="font-mono text-xs text-gray-300 break-all">
                      {txHash}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-white mb-2">Next steps for seller:</p>
                    <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                      <li>Go to "My Agents" page</li>
                      <li>Find agent #{tokenId}</li>
                      <li>Click "Transfer" button</li>
                      <li>Enter buyer address: {address}</li>
                      <li>Confirm transfer</li>
                    </ol>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    <p>We're monitoring the blockchain.</p>
                    <p>You'll be redirected once the transfer is complete.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20">
            <div className="mb-6">
              <h1 className="text-4xl font-bold text-white mb-4">{agent.name}</h1>
              
              <div className="flex flex-wrap gap-3 mb-6">
                <Badge className="bg-purple-500/80 text-white px-4 py-1">
                  Token #{tokenId}
                </Badge>
                <Badge className="bg-cyan-500/80 text-white px-4 py-1">
                  {agent.model}
                </Badge>
                {agent.isOwner && (
                  <Badge className="bg-green-500/80 text-white px-4 py-1">
                    Owned by you
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  Description
                </h3>
                <p className="text-gray-300">{agent.description}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  System Prompt
                </h3>
                <div className="bg-black/30 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-400 font-mono whitespace-pre-wrap">
                    {agent.systemPrompt || 'No system prompt available'}
                  </p>
                </div>
              </div>
              
              <div className="border-t border-white/20 pt-6">
                <div className="mb-6">
                  <p className="text-sm text-gray-400 mb-1">Price</p>
                  <p className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                    {agent.price} OG
                  </p>
                </div>
                
                {isConnected ? (
                  agent.isOwner ? (
                    <div className="space-y-3">
                      <p className="text-center text-green-400 font-semibold">
                        ✅ You own this agent!
                      </p>
                      <Button 
                        onClick={() => router.push(`/agent/${tokenId}/chat`)}
                        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-white font-bold text-lg hover:opacity-90 transition-all shadow-lg"
                      >
                        <MessageCircle className="mr-2 h-5 w-5" />
                        Chat with Agent
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={purchaseAgent}
                      disabled={purchasing}
                      className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-bold text-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                    >
                      {purchasing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="mr-2 h-5 w-5" />
                          Buy Now
                        </>
                      )}
                    </Button>
                  )
                ) : (
                  <div className="text-center">
                    <p className="text-gray-400 mb-4">Connect wallet to purchase</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
