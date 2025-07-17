// web/app/agents/page.tsx - полная версия с исправлениями
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
  Sparkles,
  Ban,
  Copy,
  GraduationCap,
  Brain,
  Settings,
  BookOpen,
  Zap
} from 'lucide-react'
import { TransferModal } from '@/components/agents/TransferModal'
import { CloneModal } from '@/components/agents/CloneModal'
import { PromptManager } from '@/components/agents/PromptManager'

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
  const [mounted, setMounted] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [cloneModalOpen, setCloneModalOpen] = useState(false)
  const [promptModalOpen, setPromptModalOpen] = useState(false)
  const [selectedForTransfer, setSelectedForTransfer] = useState<any>(null)
  const [selectedForClone, setSelectedForClone] = useState<any>(null)
  const [selectedForPrompt, setSelectedForPrompt] = useState<any>(null)
  const [cancellingListingId, setCancellingListingId] = useState<number | null>(null)

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
          
          // Получаем метаданные
          let metadataHash = ''
          
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
          
          // Загружаем метаданные
          let metadata = null
          if (metadataHash) {
            try {
              const response = await fetch('/api/storage/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootHash: metadataHash })
              })
              
              if (response.ok) {
                const data = await response.json()
                metadata = JSON.parse(data.content)
                console.log('Metadata loaded successfully:', metadata)
              }
            } catch (error) {
              console.error('Failed to load metadata:', error)
            }
          }
          
          // Если метаданные не загрузились, используем дефолтные
          if (!metadata) {
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
          
          userAgents.push({
            tokenId: Number(tokenId),
            metadataHash,
            metadata: metadata,
            status: isListed ? 'listed' : 'owned',
            listingInfo: listingInfo
          })
        } catch (err) {
          console.error(`Error fetching user token ${i}:`, err)
        }
      }
      
      console.log('Final agents:', userAgents)
      setAgents(userAgents)
      
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

  // Don't render until mounted to avoid hydration errors
  if (!mounted) {
    return null
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white">Loading your AI agents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="container mx-auto py-10 px-4 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2 flex items-center gap-3">
                <GraduationCap className="h-12 w-12 text-purple-400" />
                My Agent Campus
              </h1>
              <p className="text-gray-300">
                Train, evolve, and manage your AI agents
              </p>
            </div>
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
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Agent
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-12 border border-white/20">
              <div className="text-8xl mb-6">🐼</div>
              <h2 className="text-2xl font-bold text-white mb-4">No agents in your campus yet</h2>
              <p className="text-gray-300 mb-8">
                Start your AI learning journey by creating your first agent!
              </p>
              <Link href="/mint">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600">
                  <GraduationCap className="mr-2 h-5 w-5" />
                  Enroll Your First Agent
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card 
                key={`${agent.tokenId}-${agent.status}`}
                className="group bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-[1.02] overflow-hidden"
              >
                <CardHeader>
                  <div className="relative">
                    <div className="h-48 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-xl mb-4 flex items-center justify-center overflow-hidden group-hover:from-purple-600/40 group-hover:to-pink-600/40 transition-colors">
                      <img 
                        src={agent.metadata?.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.tokenId}`}
                        alt={agent.metadata?.name}
                        className="w-32 h-32 object-contain group-hover:scale-110 transition-transform"
                      />
                    </div>
                    
                    {/* Status Badge */}
                    {agent.status === 'listed' && (
                      <Badge className="absolute top-2 right-2 bg-purple-500/80">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Listed
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl text-white">
                        {agent.metadata?.name || `Agent #${agent.tokenId}`}
                      </CardTitle>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="bg-white/20">
                          #{agent.tokenId}
                        </Badge>
                        <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/30">
                          <Brain className="w-3 h-3 mr-1" />
                          {agent.metadata?.model || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-sm text-gray-300 mb-4 line-clamp-2">
                    {agent.metadata?.description || 'Ready to learn and assist!'}
                  </p>
                  
                  {/* Agent Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-purple-900/30 rounded-lg p-2 text-center">
                      <Zap className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                      <p className="text-xs text-purple-300">Active</p>
                    </div>
                    <div className="bg-indigo-900/30 rounded-lg p-2 text-center">
                      <BookOpen className="w-4 h-4 mx-auto mb-1 text-indigo-400" />
                      <p className="text-xs text-indigo-300">Learning</p>
                    </div>
                    <div className="bg-pink-900/30 rounded-lg p-2 text-center">
                      <MessageCircle className="w-4 h-4 mx-auto mb-1 text-pink-400" />
                      <p className="text-xs text-pink-300">Ready</p>
                    </div>
                  </div>
                  
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
                  
                  {/* Actions */}
                  <div className="space-y-2">
                    {agent.status === 'owned' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Link href={`/agent/${agent.tokenId}/chat`}>
                            <Button variant="outline" className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20">
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Chat
                            </Button>
                          </Link>
                          <Button 
                            onClick={() => {
                              setSelectedForPrompt(agent)
                              setPromptModalOpen(true)
                            }}
                            variant="outline"
                            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Prompt
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            onClick={() => handleClone(agent)}
                            variant="outline"
                            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </Button>
                          <Button 
                            onClick={() => handleTransfer(agent)}
                            variant="outline"
                            className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Transfer
                          </Button>
                        </div>
                        
                        <Button 
                          onClick={() => setSelectedAgent(agent)}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          List for Sale
                        </Button>
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

      {/* Modals */}
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

      <PromptManager
        agent={selectedForPrompt}
        isOpen={promptModalOpen}
        onClose={() => {
          setPromptModalOpen(false)
          setSelectedForPrompt(null)
        }}
        onUpdate={async (newPrompt) => {
          // Сохраняем новый промпт
          console.log('Updated prompt for agent:', selectedForPrompt?.tokenId, newPrompt)
          toast({
            title: 'Success!',
            description: 'Agent prompt updated successfully'
          })
          setPromptModalOpen(false)
        }}
      />
    </div>
  )
}