// web/app/agents/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { INFT_ABI, AGENT_MARKETPLACE_ABI } from '@/lib/contracts/abis'
import { toast } from '@/components/ui/use-toast'
import { parseEther, formatEther } from 'viem'
import { 
  ShoppingCart, 
  MessageCircle, 
  Loader2, 
  Plus, 
  RefreshCw, 
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Ban,
  Copy
} from 'lucide-react'
import { TransferModal } from '@/components/agents/TransferModal'
import { CloneModal } from '@/components/agents/CloneModal'

interface Agent {
  tokenId: number
  metadataHash: string
  metadata: any
  status?: 'owned' | 'pending_purchase' | 'pending_transfer' | 'listed'
  pendingInfo?: any
  listingInfo?: any
}

export default function AgentsPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [listingPrice, setListingPrice] = useState('')
  const [isListing, setIsListing] = useState(false)
  const [transferAgent, setTransferAgent] = useState<any>(null)
  const [transferAddress, setTransferAddress] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [cancellingListingId, setCancellingListingId] = useState<number | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [selectedForTransfer, setSelectedForTransfer] = useState<any>(null)
  const [selectedForClone, setSelectedForClone] = useState<any>(null)

  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`
  const marketplaceAddress = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}`

  // Fix hydration error
  useEffect(() => {
    setMounted(true)
  }, [])

  const loadAgents = async () => {
    if (!address || !publicClient || !mounted) {
      setLoading(false)
      return
    }

    try {
      console.log('Loading agents for:', address)
      
      // Получаем баланс NFT пользователя
      const balance = await publicClient.readContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'balanceOf',
        args: [address]
      }) as bigint
      
      console.log('User balance:', balance.toString(), 'tokens')
      
      const userAgents: Agent[] = []
      const pendingPurchases = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('pendingTransfers') || '{}')
        : {}
      
      console.log('Pending purchases:', pendingPurchases)
      
      // Получаем токены пользователя через tokenOfOwnerByIndex
      for (let i = 0; i < Number(balance); i++) {
        try {
          const tokenId = await publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [address, BigInt(i)]
          }) as bigint
          
          console.log(`User's token ${i}:`, tokenId.toString())
          
          // Получаем метаданные - пробуем разные методы
          let metadataHash = ''
          
          // Сначала пробуем getMetadataHash
          try {
            metadataHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getMetadataHash',
              args: [tokenId]
            }) as string
            console.log('Got metadata hash:', metadataHash)
          } catch (e) {
            console.log('getMetadataHash failed, trying tokenURI...')
            // Если не работает, пробуем tokenURI
            try {
              metadataHash = await publicClient.readContract({
                address: contractAddress,
                abi: INFT_ABI,
                functionName: 'tokenURI',
                args: [tokenId]
              }) as string
              console.log('Got tokenURI:', metadataHash)
            } catch (e2) {
              console.error('Both getMetadataHash and tokenURI failed for token', tokenId.toString())
            }
          }
          
          // Загружаем метаданные с retry
          let metadata = null
          let retryCount = 0
          const maxRetries = 3
          
          while (retryCount < maxRetries && metadataHash) {
            try {
              console.log(`Attempting to fetch metadata (attempt ${retryCount + 1})...`)
              const response = await fetch('/api/storage/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootHash: metadataHash })
              })
              
              if (response.ok) {
                const data = await response.json()
                metadata = JSON.parse(data.content)
                console.log('Metadata loaded successfully:', metadata)
                break
              } else {
                console.error('Failed to load metadata, status:', response.status)
              }
            } catch (error) {
              console.error(`Metadata fetch attempt ${retryCount + 1} failed:`, error)
            }
            
            retryCount++
            if (retryCount < maxRetries) {
              // Ждем перед повторной попыткой
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
          
          // Если метаданные не загрузились, используем дефолтные
          if (!metadata) {
            console.log('Using default metadata for token', tokenId.toString())
            metadata = {
              name: `Agent #${tokenId}`,
              description: 'Loading metadata...',
              model: 'Unknown',
              image: `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenId}`
            }
          }
          
          // Проверяем, выставлен ли на продажу
          let isListed = false
          let listingInfo = null
          try {
            const listing = await publicClient.readContract({
              address: marketplaceAddress,
              abi: AGENT_MARKETPLACE_ABI,
              functionName: 'getListing',
              args: [tokenId]
            })
            
            if (listing && listing.isActive && listing.seller.toLowerCase() === address.toLowerCase()) {
              isListed = true
              listingInfo = {
                price: listing.price,
                listedAt: listing.listedAt
              }
            }
          } catch (error) {
            console.log(`No listing for token ${tokenId}`)
          }
          
          // Проверяем, есть ли запросы на покупку этого токена
          const purchaseRequests = Object.values(pendingPurchases).filter(
            (p: any) => p.tokenId === tokenId.toString() && p.seller.toLowerCase() === address.toLowerCase()
          )
          
          console.log(`Token ${tokenId} - listed: ${isListed}, purchase requests:`, purchaseRequests)
          
          userAgents.push({
            tokenId: Number(tokenId),
            metadataHash,
            metadata: metadata,
            status: isListed ? 'listed' : (purchaseRequests.length > 0 ? 'pending_transfer' : 'owned'),
            pendingInfo: purchaseRequests[0],
            listingInfo: listingInfo
          })
        } catch (err) {
          console.error(`Error fetching user token ${i}:`, err)
        }
      }
      
      // Также проверяем pending purchases из totalSupply (для обратной совместимости)
      try {
        const totalSupply = await publicClient.readContract({
          address: contractAddress,
          abi: INFT_ABI,
          functionName: 'totalSupply',
        })
        
        // Проверяем pending purchases
        for (let i = 1; i <= Number(totalSupply); i++) {
          if (pendingPurchases[i.toString()]) {
            const purchase = pendingPurchases[i.toString()]
            if (purchase.buyer.toLowerCase() === address.toLowerCase()) {
              // Проверяем, не добавили ли мы уже этот токен
              const alreadyAdded = userAgents.some(a => a.tokenId === i)
              if (!alreadyAdded) {
                console.log(`Token ${i} - pending purchase for me`)
                userAgents.push({
                  tokenId: i,
                  metadataHash: '',
                  metadata: {
                    name: `Agent #${i}`,
                    description: 'Transfer pending...',
                    model: 'Unknown'
                  },
                  status: 'pending_purchase',
                  pendingInfo: purchase
                })
              }
            }
          }
        }
      } catch (error) {
        console.log('Error checking total supply for pending purchases:', error)
      }
      
      console.log('Final agents:', userAgents)
      setAgents(userAgents)
      
      // Если есть агенты с незагруженными метаданными, попробуем перезагрузить через 5 секунд
      const hasLoadingMetadata = userAgents.some(a => a.metadata?.description === 'Loading metadata...')
      if (hasLoadingMetadata && !refreshing) {
        console.log('Some metadata still loading, scheduling retry...')
        setTimeout(() => {
          loadAgents()
        }, 5000)
      }
    } catch (error) {
      console.error('Error loading agents:', error)
      toast({
        title: 'Error',
        description: 'Failed to load agents',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (mounted) {
      loadAgents()
      
      // Обновляем каждые 15 секунд
      const interval = setInterval(loadAgents, 15000)
      return () => clearInterval(interval)
    }
  }, [address, publicClient, mounted])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAgents()
  }

  const handleTransfer = (agent: any) => {
    setSelectedForTransfer(agent)
    setTransferModalOpen(true)
  }

  const handleClone = (agent: any) => {
    setSelectedForClone(agent)
    setCloneModalOpen(true)
  }

  const listAgentForSale = async () => {
    if (!selectedAgent || !listingPrice || !walletClient) return
    
    setIsListing(true)
    try {
      // 1. Approve
      const approveTx = await walletClient.writeContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'approve',
        args: [marketplaceAddress, BigInt(selectedAgent.tokenId)]
      })
      
      await publicClient.waitForTransactionReceipt({ hash: approveTx })
      
      toast({
        title: 'Step 1/2: Approved',
        description: 'Now listing on marketplace...'
      })
      
      // 2. List
      const priceInWei = parseEther(listingPrice)
      const listTx = await walletClient.writeContract({
        address: marketplaceAddress,
        abi: AGENT_MARKETPLACE_ABI,
        functionName: 'listItem',
        args: [
          contractAddress,
          BigInt(selectedAgent.tokenId),
          priceInWei
        ]
      })
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: listTx })
      
      if (receipt.status === 'success') {
        toast({
          title: 'Success!',
          description: `${selectedAgent.metadata.name} listed for ${listingPrice} OG`
        })
        
        setSelectedAgent(null)
        setListingPrice('')
        setTimeout(loadAgents, 2000)
      }
    } catch (error: any) {
      console.error('Listing error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to list agent',
        variant: 'destructive'
      })
    } finally {
      setIsListing(false)
    }
  }

  const cancelListing = async (agent: Agent) => {
    if (!walletClient) return
    
    setCancellingListingId(agent.tokenId)
    try {
      const tx = await walletClient.writeContract({
        address: marketplaceAddress,
        abi: AGENT_MARKETPLACE_ABI,
        functionName: 'cancelListing',
        args: [
          contractAddress,
          BigInt(agent.tokenId)
        ]
      })
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      
      if (receipt.status === 'success') {
        toast({
          title: 'Success!',
          description: 'Listing cancelled successfully'
        })
        
        setTimeout(loadAgents, 2000)
      }
    } catch (error: any) {
      console.error('Cancel listing error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel listing',
        variant: 'destructive'
      })
    } finally {
      setCancellingListingId(null)
    }
  }

  const transferNFT = async () => {
    if (!transferAgent || !transferAddress || !walletClient) return
    
    setIsTransferring(true)
    try {
      const tx = await walletClient.writeContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'transferFrom',
        args: [
          address as `0x${string}`,
          transferAddress as `0x${string}`,
          BigInt(transferAgent.tokenId)
        ]
      })
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx })
      
      if (receipt.status === 'success') {
        // Удаляем из pending transfers
        if (typeof window !== 'undefined') {
          const pendingPurchases = JSON.parse(localStorage.getItem('pendingTransfers') || '{}')
          delete pendingPurchases[transferAgent.tokenId.toString()]
          localStorage.setItem('pendingTransfers', JSON.stringify(pendingPurchases))
        }
        
        toast({
          title: 'Success!',
          description: 'NFT transferred successfully!'
        })
        
        setTransferAgent(null)
        setTransferAddress('')
        setTimeout(loadAgents, 2000)
      }
    } catch (error: any) {
      console.error('Transfer error:', error)
      toast({
        title: 'Error',
        description: error.message || 'Transfer failed',
        variant: 'destructive'
      })
    } finally {
      setIsTransferring(false)
    }
  }

  // Don't render until mounted to avoid hydration errors
  if (!mounted) {
    return null
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
            <Sparkles className="w-16 h-16 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Connect Your Wallet</h1>
          <p className="text-gray-300">Please connect your wallet to view your AI agents</p>
        </div>
      </div>
    )
  }

  if (loading && agents.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading your AI agents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="container mx-auto py-10 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-bold text-white">My AI Agents</h1>
            <div className="flex gap-3">
              <Button 
                onClick={handleRefresh} 
                variant="outline"
                disabled={refreshing}
                className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/mint">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Agent
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-gray-300">
            Connected as: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-12 border border-white/20">
              <img 
                src="https://api.dicebear.com/7.x/bottts/svg?seed=empty" 
                alt="No agents"
                className="w-32 h-32 mx-auto mb-6 opacity-70"
              />
              <h2 className="text-2xl font-bold text-white mb-4">No agents found</h2>
              <p className="text-gray-300 mb-8">
                Create your first AI agent or wait for pending transfers to complete.
              </p>
              <Link href="/mint">
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card 
                key={`${agent.tokenId}-${agent.status}`}
                className={`
                  bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all
                  ${agent.status === 'pending_purchase' ? 'border-yellow-500/50' : ''}
                  ${agent.status === 'pending_transfer' ? 'border-green-500/50' : ''}
                  ${agent.status === 'listed' ? 'border-purple-500/50' : ''}
                `}
              >
                <CardHeader>
                  <div className="relative">
                    <div className="h-48 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                      <img 
                        src={agent.metadata?.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.tokenId}`}
                        alt={agent.metadata?.name}
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    
                    {/* Status Badge */}
                    {agent.status === 'pending_purchase' && (
                      <Badge className="absolute top-2 right-2 bg-yellow-500/80">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Purchase
                      </Badge>
                    )}
                    {agent.status === 'pending_transfer' && (
                      <Badge className="absolute top-2 right-2 bg-green-500/80">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Transfer Needed
                      </Badge>
                    )}
                    {agent.status === 'listed' && (
                      <Badge className="absolute top-2 right-2 bg-purple-500/80">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Listed
                      </Badge>
                    )}
                    {agent.metadata?.description === 'Loading metadata...' && (
                      <Badge className="absolute top-2 left-2 bg-orange-500/80">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Loading...
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl text-white">
                        {agent.metadata?.name || `Agent #${agent.tokenId}`}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1 bg-white/20">
                        Token #{agent.tokenId}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="border-white/30 text-white">
                      {agent.metadata?.model || 'Unknown'}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4 line-clamp-2">
                    {agent.metadata?.description || 'No description available'}
                  </p>
                  
                  {/* Listing info */}
                  {agent.status === 'listed' && agent.listingInfo && (
                    <div className="mb-4 p-3 bg-purple-900/30 rounded-lg text-xs">
                      <div className="space-y-1 text-purple-300">
                        <p>Listed for sale</p>
                        <p className="text-white font-semibold">
                          Price: {formatEther(agent.listingInfo.price)} OG
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Pending info */}
                  {agent.pendingInfo && (
                    <div className="mb-4 p-3 bg-black/30 rounded-lg text-xs">
                      {agent.status === 'pending_purchase' ? (
                        <div className="space-y-1 text-yellow-300">
                          <p>Waiting for transfer from:</p>
                          <p className="font-mono break-all">{agent.pendingInfo.seller}</p>
                          <p className="text-gray-400">
                            Paid: {formatEther(BigInt(agent.pendingInfo.price))} OG
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-green-300">
                          <p>Transfer requested by:</p>
                          <p className="font-mono break-all">{agent.pendingInfo.buyer}</p>
                          <p className="text-gray-400">
                            Amount: {formatEther(BigInt(agent.pendingInfo.price))} OG
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="space-y-2">
                    {agent.status === 'owned' && (
                      <>
                        <div className="flex gap-2">
                          <Link href={`/agent/${agent.tokenId}/chat`} className="flex-1">
                            <Button variant="outline" className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20">
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Chat
                            </Button>
                          </Link>
                          <Button 
                            onClick={() => setSelectedAgent(agent)}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Sell
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleClone(agent)}
                            variant="outline"
                            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </Button>
                          <Button 
                            onClick={() => handleTransfer(agent)}
                            variant="outline"
                            className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Transfer
                          </Button>
                        </div>
                      </>
                    )}
                    
                    {agent.status === 'listed' && (
                      <>
                        <Link href={`/agent/${agent.tokenId}/chat`} className="block">
                          <Button variant="outline" className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Chat
                          </Button>
                        </Link>
                        <Button 
                          onClick={() => cancelListing(agent)}
                          disabled={cancellingListingId === agent.tokenId}
                          className="w-full bg-gradient-to-r from-red-500 to-orange-500"
                        >
                          {cancellingListingId === agent.tokenId ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              Cancel Listing
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    
                    {agent.status === 'pending_transfer' && agent.pendingInfo && (
                      <Button 
                        onClick={() => {
                          console.log('Setting transfer agent:', agent)
                          setTransferAgent(agent)
                          setTransferAddress(agent.pendingInfo.buyer)
                        }}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Transfer to Buyer
                      </Button>
                    )}
                    
                    {agent.status === 'pending_purchase' && (
                      <Button disabled className="w-full opacity-50">
                        <Clock className="h-4 w-4 mr-2" />
                        Waiting for Transfer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* List for Sale Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>List {selectedAgent?.metadata?.name} for Sale</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set your price in OG tokens. The agent will be listed on the marketplace.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-sm font-medium">{selectedAgent?.metadata?.name}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedAgent?.metadata?.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">Token #{selectedAgent?.tokenId}</Badge>
                <Badge variant="outline" className="text-xs">{selectedAgent?.metadata?.model}</Badge>
              </div>
            </div>
            
            <div>
              <Label htmlFor="price">Price (OG)</Label>
              <Input
                id="price"
                type="number"
                step="0.001"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                placeholder="0.001"
                className="mt-1 bg-gray-800 border-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum price: 0.001 OG
              </p>
            </div>
            
            <Button
              onClick={listAgentForSale}
              disabled={isListing || !listingPrice || parseFloat(listingPrice) < 0.001}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {isListing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Listing...
                </>
              ) : (
                'List for Sale'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferAgent} onOpenChange={() => setTransferAgent(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Transfer NFT to Buyer</DialogTitle>
            <DialogDescription className="text-gray-400">
              The buyer has sent payment. Complete the transfer to finish the sale.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="bg-green-900/30 border border-green-500/30 p-4 rounded-lg">
              <p className="text-sm text-green-300 mb-2">Payment Received!</p>
              <p className="text-xs text-gray-400">
                Amount: {transferAgent?.pendingInfo && formatEther(BigInt(transferAgent.pendingInfo.price))} OG
              </p>
              <p className="text-xs text-gray-400 break-all">
                Transaction: {transferAgent?.pendingInfo?.txHash.slice(0, 10)}...
              </p>
            </div>
            
            <div>
              <Label htmlFor="buyerAddress">Buyer Address</Label>
              <Input
                id="buyerAddress"
                value={transferAddress}
                onChange={(e) => setTransferAddress(e.target.value)}
                className="mt-1 bg-gray-800 border-gray-700 font-mono text-sm"
                readOnly
              />
            </div>
            
            <div className="bg-yellow-900/30 border border-yellow-500/30 p-3 rounded-lg">
              <p className="text-xs text-yellow-300">
                ⚠️ This action is irreversible. Make sure the payment transaction is confirmed.
              </p>
            </div>
            
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setTransferAgent(null)}
                className="flex-1 bg-gray-800 border-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={transferNFT}
                disabled={isTransferring || !transferAddress}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
              >
                {isTransferring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Transfer NFT
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal с TEE */}
      <TransferModal
        agent={selectedForTransfer}
        isOpen={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false)
          setSelectedForTransfer(null)
        }}
        onSuccess={() => {
          setTransferModalOpen(false)
          setSelectedForTransfer(null)
          loadAgents()
        }}
      />

      {/* Clone Modal */}
      <CloneModal
        agent={selectedForClone}
        isOpen={cloneModalOpen}
        onClose={() => {
          setCloneModalOpen(false)
          setSelectedForClone(null)
        }}
        onSuccess={() => {
          setCloneModalOpen(false)
          setSelectedForClone(null)
          loadAgents()
        }}
      />
    </div>
  )
}