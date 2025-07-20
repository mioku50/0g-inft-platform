// web/app/marketplace/[tokenId]/page.tsx
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
        functionName: 'getMetadataHash',
        args: [BigInt(tokenId)]
      })
      
      // Получаем цену из листинга
      let price = '0.001'
      let isListed = false
      try {
        const listingData = await publicClient.readContract({
          address: marketplaceAddress,
          abi: AGENT_MARKETPLACE_ABI,
          functionName: 'getListing',
          args: [BigInt(tokenId)]
        })
        
        if (listingData && listingData.isActive && listingData.price) {
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
        const metadata = JSON.parse(data.content)
        
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
      const currentOwner = await publicClient.readContract({
        address: nftAddress,
        abi: INFT_ABI,
        functionName: 'ownerOf',
        args: [BigInt(tokenId)]
      })
      
      if (currentOwner.toLowerCase() === address.toLowerCase()) {
        throw new Error('You already own this agent!')
      }
      
      const price = agent.price ? parseEther(agent.price.toString()) : parseEther('0.001')
      
      toast({
        title: 'Sending payment...',
        description: `Sending ${formatEther(price)} OG to owner`
      })
      
      const tx = await walletClient.sendTransaction({
        to: currentOwner as `0x${string}`,
        value: price,
      })
      
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: tx,
        confirmations: 1 
      })
      
      if (receipt.status === 'success') {
        toast({
          title: '✅ Payment sent!',
          description: `Successfully sent ${formatEther(price)} OG to the owner`,
          duration: 5000
        })
        
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
        
        setShowTransferInfo(true)
        
        toast({
          title: '📋 Next Steps',
          description: 'The owner needs to transfer the NFT to you. Transaction: ' + tx.slice(0, 10) + '...',
          duration: 10000
        })
        
        checkOwnershipStatus(tokenId)
      }
    } catch (error: any) {
      console.error('Full error:', error)
      
      let errorMessage = 'Purchase failed'
      if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient balance. You need more OG tokens.'
      } else if (error.message?.includes('user rejected')) {
        errorMessage = 'Transaction was cancelled'
      } else if (error.message?.includes('already own')) {
        errorMessage = error.message
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
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
            duration: 5000
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
      {/* Animated stars background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      <div className="relative container mx-auto py-10 px-4">
        {/* Back button */}
        <Link href="/marketplace">
          <Button variant="ghost" className="mb-6 text-white hover:text-purple-300 hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>

        {/* Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Image and Transfer Info */}
          <div className="space-y-6">
            {/* Agent Image Card */}
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
              
              {/* Agent Stats */}
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
            
            {/* Transfer Info Card */}
     // web/app/marketplace/[tokenId]/page.tsx
// После успешной оплаты добавьте:

{showTransferInfo && (
  <div className="bg-yellow-500/10 backdrop-blur-md rounded-3xl p-6 border border-yellow-500/30 mt-4">
    <h3 className="text-lg font-semibold text-yellow-400 mb-3">
      ⚠️ Manual Transfer Required
    </h3>
    
    <div className="space-y-4">
      <div className="bg-black/30 rounded-xl p-4">
        <p className="text-sm text-white mb-2">Payment Transaction:</p>
        <p className="font-mono text-xs text-gray-300 break-all">
          {/* Показать hash транзакции */}
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

          {/* Right Column - Agent Details */}
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
              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  Description
                </h3>
                <p className="text-gray-300">
                  {agent.description}
                </p>
              </div>
              
              {/* System Prompt */}
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
              
              {/* Price and Purchase */}
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
                    <Button 
                      onClick={() => {}}
                      className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-semibold hover:opacity-90 transition-all shadow-lg"
                    >
                      Connect Wallet
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS для звезд */}
     {/* CSS для звезд и градиентов */}
<style jsx>{`
  @keyframes gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
  
  .stars {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 120%;
    overflow: hidden;
  }
  
  .stars::after {
    content: "";
    position: absolute;
    top: -10rem;
    left: -10rem;
    right: -10rem;
    bottom: -10rem;
    background-image: 
      radial-gradient(2px 2px at 20% 30%, white, transparent),
      radial-gradient(2px 2px at 60% 70%, white, transparent),
      radial-gradient(1px 1px at 50% 50%, white, transparent),
      radial-gradient(1px 1px at 80% 10%, white, transparent),
      radial-gradient(2px 2px at 90% 60%, white, transparent);
    background-size: 200px 200px;
    background-position: 0 0, 40px 60px, 130px 270px, 70px 100px, 150px 150px;
    animation: moveStars 100s linear infinite;
    opacity: 0.5;
  }
  
  .stars2 {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 120%;
    overflow: hidden;
  }
  
  .stars2::after {
    content: "";
    position: absolute;
    top: -10rem;
    left: -10rem;
    right: -10rem;
    bottom: -10rem;
    background-image: 
      radial-gradient(3px 3px at 30% 40%, white, transparent),
      radial-gradient(2px 2px at 70% 20%, white, transparent),
      radial-gradient(1px 1px at 40% 80%, white, transparent);
    background-size: 300px 300px;
    background-position: 20px 30px, 150px 180px, 70px 70px;
    animation: moveStars 150s linear infinite;
    opacity: 0.3;
  }
  
  .stars3 {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 120%;
    overflow: hidden;
  }
  
  .stars3::after {
    content: "";
    position: absolute;
    top: -10rem;
    left: -10rem;
    right: -10rem;
    bottom: -10rem;
    background-image: 
      radial-gradient(1px 1px at 10% 10%, white, transparent),
      radial-gradient(1px 1px at 90% 90%, white, transparent);
    background-size: 400px 400px;
    background-position: 50px 50px, 200px 300px;
    animation: moveStars 200s linear infinite;
    opacity: 0.2;
  }
  
  @keyframes moveStars {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-100%);
    }
  }
`}</style>
    </div>
  )
}