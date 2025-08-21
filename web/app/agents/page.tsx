// web/app/agents/page.tsx
'use client'
import React from 'react'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { 
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
  Badge,
  Skeleton,
  useToast,
} from '@/components/ui'
import Link from 'next/link'
import { INFT_ABI, AGENT_MARKETPLACE_ABI } from '@/lib/contracts/abis'
import { toast } from '@/components/ui'
import { parseEther, formatEther } from 'viem'
import { 
  ShoppingCart, 
  MessageCircle, 
  Loader2, 
  Plus, 
  RefreshCw, 
  Send,
  Copy,
  
  Settings,
  Ban,
  Sparkles,
  Bot,
  ImageOff
} from 'lucide-react'
import { TransferModal } from '@/components/agents/TransferModal'
import { CloneModal } from '@/components/agents/CloneModal'
import { PromptManager } from '@/components/agents/PromptManager'
import AgentAvatar from '@/components/agents/AgentAvatar'
import { getCachedMetadata } from '@/lib/cache/local-metadata'

const metadataCache = new Map<string, any>()

interface Agent {
  tokenId: number
  metadataHash: string
  metadata: any
  status?: 'owned' | 'pending_purchase' | 'pending_transfer' | 'listed'
  pendingInfo?: any
  listingInfo?: any
}

interface AgentCardProps {
  agent: Agent
  onTransfer: (agent: Agent) => void
  onClone: (agent: Agent) => void
  onList: (agent: Agent) => void
  onCancelListing: (agent: Agent) => void
  onPrompt: (agent: Agent) => void
  cancellingListingId: number | null
}

// Оптимизированная карточка агента
const AgentCard = React.memo(({
  agent,
  onTransfer,
  onClone,
  onList,
  onCancelListing,
  onPrompt,
  cancellingListingId
}: AgentCardProps) => {
  return (
    <div 
      className="h-full flex flex-col bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl rounded-2xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      <div className="p-6 flex-1 flex flex-col">
        {/* Agent Image */}
        <div className="h-48 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
          <AgentAvatar agent={agent} size="large" />
          
          {agent.status === 'listed' && (
            <Badge className="absolute top-2 right-2 bg-purple-600 text-white">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Listed
            </Badge>
          )}
        </div>
        
        {/* Agent Info */}
        <h3 className="text-xl font-bold text-gray-900 mb-1">
          {agent.metadata?.name || `Agent #${agent.tokenId}`}
        </h3>
        
        <div className="flex gap-2 mb-3">
          <Badge variant="outline" className="border-purple-300 text-purple-700">
            #{agent.tokenId}
          </Badge>
          <Badge className="bg-purple-100 text-purple-700 border-0">
            {agent.metadata?.model || 'Unknown'}
          </Badge>
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {agent.metadata?.description || 'AI Assistant'}
        </p>
        
        {/* Listing info */}
        {agent.status === 'listed' && agent.listingInfo && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-900">
              Listed for: <span className="font-bold">{formatEther(agent.listingInfo.price)} OG</span>
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="space-y-2 mt-auto">
          {agent.status === 'owned' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/agent/${agent.tokenId}`}>
                  <Button variant="outline" size="sm" className="w-full border-purple-200 hover:bg-purple-50 text-gray-700">
                    <MessageCircle className="h-4 w-4 mr-1" />
                    Chat
                  </Button>
                </Link>
                <Button 
                  onClick={() => onPrompt(agent)}
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-200 hover:bg-purple-50 text-gray-700"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Prompt
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => onClone(agent)}
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-200 hover:bg-purple-50 text-gray-700"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Clone
                </Button>
                <Button 
                  onClick={() => onTransfer(agent)}
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-200 hover:bg-purple-50 text-gray-700"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Transfer
                </Button>
              </div>

              <div>
                <Button 
                  onClick={() => onList(agent)}
                  size="sm"
                  className="w-full justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>
            </>
          )}
          
          {agent.status === 'listed' && (
            <>
              <Link href={`/agent/${agent.tokenId}`} className="block">
                <Button variant="outline" size="sm" className="w-full border-purple-200 hover:bg-purple-50 text-gray-700">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat
                </Button>
              </Link>
              <Button 
                onClick={() => onCancelListing(agent)}
                disabled={cancellingListingId === agent.tokenId}
                variant="destructive"
                size="sm"
                className="w-full bg-red-600 hover:bg-red-700 text-white"
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
      </div>
    </div>
  )
})

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

  useEffect(() => {
    setMounted(true)
  }, [])

  // Оптимизированная загрузка агентов с кешированием
  const loadAgents = useCallback(async () => {
    if (!address || !publicClient || !mounted) {
      setLoading(false)
      return
    }

    try {
      const balance = await publicClient.readContract({
        address: contractAddress,
        abi: INFT_ABI,
        functionName: 'balanceOf',
        args: [address]
      }) as bigint
      
      const userAgents: Agent[] = []
      
      // Загружаем все токены параллельно для оптимизации
      const tokenPromises = []
      for (let i = 0; i < Number(balance); i++) {
        tokenPromises.push(
          publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [address, BigInt(i)]
          })
        )
      }
      
      const tokenIds = await Promise.all(tokenPromises)
      
      // Загружаем метаданные параллельно
      const agentPromises = tokenIds.map(async (tokenId) => {
        try {
          let rootHash = ''
          try {
            rootHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getEncryptedURI',
              args: [tokenId]
            }) as string
          } catch (e) {
            console.error('Failed to get encryptedURI for token', tokenId.toString(), e)
          }
          
          let metadata = null
          if (rootHash && rootHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            if (rootHash.startsWith('local://')) {
              metadata = getCachedMetadata(rootHash.replace('local://','')) || null
            }
            if (!metadata && metadataCache.has(rootHash)) {
              metadata = metadataCache.get(rootHash)
            } else {
              try {
                const response = await fetch('/api/storage/retrieve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ rootHash, tokenId: tokenId.toString() })
                })

                if (response.ok) {
                  const data = await response.json()
                  if (data.content) {
                    metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
                    metadataCache.set(rootHash, metadata)
                  }
                }
              } catch (error) {
                console.error('Failed to load metadata:', error)
              }
            }
          }
          
          if (!metadata || metadata.error === 'metadata_not_found') {
            metadata = {
              name: `Agent #${tokenId}`,
              description: 'AI Agent',
              model: 'llama-3.3-70b',
              image: `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenId}`,
              personality: 'friendly'
            }
          }
          
          // Проверяем listing статус
          let isListed = false
          let listingInfo = null
          try {
            const listing = await publicClient.readContract({
              address: marketplaceAddress,
              abi: AGENT_MARKETPLACE_ABI,
              functionName: 'getListing',
              args: [contractAddress, tokenId]
            })
            
            if (listing && listing.isActive && listing.seller.toLowerCase() === address.toLowerCase()) {
              isListed = true
              listingInfo = {
                price: listing.price,
                listedAt: listing.listedAt
              }
            }
          } catch (error) {
            // No listing
          }
          
          return {
            tokenId: Number(tokenId),
            metadataHash: rootHash,
            metadata: metadata,
            status: isListed ? 'listed' : 'owned',
            listingInfo: listingInfo
          } as Agent
        } catch (err) {
          console.error(`Error fetching token ${tokenId}:`, err)
          return null
        }
      })
      
      const results = await Promise.all(agentPromises)
      const validAgents = results.filter(agent => agent !== null) as Agent[]
      
      setAgents(validAgents)
      
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
  }, [address, publicClient, mounted, contractAddress, marketplaceAddress])

  useEffect(() => {
    if (mounted) {
      loadAgents()
    }
  }, [mounted, loadAgents])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAgents()
  }

  const handleTransfer = useCallback((agent: any) => {
    setSelectedForTransfer(agent)
    setTransferModalOpen(true)
  }, [])

  const handleClone = useCallback((agent: any) => {
    setSelectedForClone(agent)
    setCloneModalOpen(true)
  }, [])

  const handlePrompt = useCallback((agent: any) => {
    setSelectedForPrompt(agent)
    setPromptModalOpen(true)
  }, [])

  const handleList = useCallback((agent: any) => {
    setSelectedAgent(agent)
  }, [])

  const listAgentForSale = async () => {
    if (!selectedAgent || !listingPrice || !walletClient || !publicClient) return
    
    setIsListing(true)
    try {
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

  const cancelListing = useCallback(async (agent: Agent) => {
    if (!walletClient || !publicClient) return
    
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
  }, [walletClient, publicClient, contractAddress, marketplaceAddress, loadAgents])

  // Мемоизированные компоненты для оптимизации
  const agentCards = useMemo(() => {
    return agents.map((agent) => (
      <AgentCard
        key={`${agent.tokenId}-${agent.status}`}
        agent={agent}
        onTransfer={handleTransfer}
        onClone={handleClone}
        onList={handleList}
        onCancelListing={cancelListing}
        onPrompt={handlePrompt}
        cancellingListingId={cancellingListingId}
      />
    ))
  }, [agents, cancellingListingId, handleTransfer, handleClone, handleList, cancelListing, handlePrompt])

  if (!mounted) {
    return null
  }

  if (!isConnected) {
    return (
      <div className="page-hero min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="p-6 bg-white/70 backdrop-blur rounded-full inline-block mb-6">
            <Bot className="w-24 h-24 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Connect Your Wallet</h1>
          <p className="text-gray-600">Please connect your wallet to explore your AI agents</p>
        </div>
      </div>
    )
  }

  if (loading && agents.length === 0) {
    return (
      <div className="page-hero min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-700">Loading your AI agents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-hero min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/70 backdrop-blur rounded-xl">
              <Bot className="h-10 w-10 text-purple-600" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                My Agent Collection
              </h1>
              <p className="text-gray-600 mt-1">Manage and interact with your AI agents</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              disabled={refreshing}
              className="bg-white/70 backdrop-blur border-purple-200 text-gray-700 hover:bg-white/90"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/mint">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create New Agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="max-w-md mx-auto bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-xl p-12">
              <div className="mb-6 inline-block p-4 bg-purple-100 rounded-full">
                <Sparkles className="w-16 h-16 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No agents yet</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-8">
                Create your first AI agent to get started!
              </p>
              <Link href="/mint">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Bot className="mr-2 h-5 w-5" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {agentCards}
          </div>
        )}
      </div>

      {/* List for Sale Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">List {selectedAgent?.metadata?.name} for Sale</DialogTitle>
            <DialogDescription>
              Set your price in OG tokens. The agent will be listed on the marketplace.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p className="font-medium">{selectedAgent?.metadata?.name}</p>
              <p className="text-sm text-gray-600 mt-1">{selectedAgent?.metadata?.description}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="border-purple-300 text-purple-700">Token #{selectedAgent?.tokenId}</Badge>
                <Badge className="bg-purple-100 text-purple-700 border-0">{selectedAgent?.metadata?.model}</Badge>
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
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum price: 0.001 OG
              </p>
            </div>
            
            <Button
              onClick={listAgentForSale}
              disabled={isListing || !listingPrice || parseFloat(listingPrice) < 0.001}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
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