'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useContractRead } from 'wagmi'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { 
  Bot, 
  MessageSquare, 
  Share2, 
  ShoppingCart, 
  Search,
  Filter,
  Grid3X3,
  List,
  Plus
} from 'lucide-react'

interface Agent {
  tokenId: string
  name: string
  description: string
  model: string
  capabilities: string[]
  image: string
  isListed: boolean
}

export default function AgentsPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // In production, fetch user's agents from contract events
  useEffect(() => {
    const fetchAgents = async () => {
      if (!address) return

      try {
        // Mock data for demo
        const mockAgents: Agent[] = [
          {
            tokenId: '1',
            name: 'Code Assistant Pro',
            description: 'Advanced AI for code generation and debugging',
            model: 'GPT-4',
            capabilities: ['code generation', 'debugging', 'refactoring'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=1',
            isListed: false
          },
          {
            tokenId: '2',
            name: 'Creative Writer',
            description: 'AI specialized in creative writing and storytelling',
            model: 'Claude 3',
            capabilities: ['creative writing', 'storytelling', 'editing'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=2',
            isListed: true
          },
          {
            tokenId: '3',
            name: 'Data Analyst',
            description: 'Expert in data analysis and visualization',
            model: 'Custom Model',
            capabilities: ['data analysis', 'visualization', 'reporting'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=3',
            isListed: false
          }
        ]
        
        setAgents(mockAgents)
      } catch (error) {
        console.error('Failed to fetch agents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [address])

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (!isConnected) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-gray-400 mb-8">Please connect your wallet to view your AI agents</p>
        <Button
          onClick={() => router.push('/')}
          variant="outline"
          className="border-gray-600"
        >
          Go to Home
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
                <Skeleton className="h-6 w-32 mx-auto mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">My AI Agents</h1>
            <p className="text-gray-400">
              Manage and interact with your intelligent NFTs
            </p>
          </div>
          <Button
            onClick={() => router.push('/mint')}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Agent
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-700"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-gray-800' : ''}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gray-800' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* No Agents State */}
      {agents.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700 text-center py-20">
          <CardContent>
            <Bot className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No AI Agents Yet
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first AI agent to get started
            </p>
            <Button
              onClick={() => router.push('/mint')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create AI Agent
            </Button>
          </CardContent>
        </Card>
      ) : filteredAgents.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700 text-center py-20">
          <CardContent>
            <Search className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No agents found
            </h3>
            <p className="text-gray-400">
              Try adjusting your search criteria
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Agents Grid/List */
        <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredAgents.map((agent) => (
            <Card
              key={agent.tokenId}
              className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-all duration-300 overflow-hidden"
            >
              {viewMode === 'grid' ? (
                <>
                  <CardHeader className="text-center">
                    <div className="relative">
                      <img
                        src={agent.image}
                        alt={agent.name}
                        className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-700 p-2"
                      />
                      {agent.isListed && (
                        <Badge className="absolute top-0 right-1/4 bg-green-600">
                          Listed
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                    <Badge variant="secondary" className="mt-2">
                      {agent.model}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 text-sm mb-4">{agent.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 3).map((cap, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                      {agent.capabilities.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agent.capabilities.length - 3}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/chat/${agent.tokenId}`)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/agents/${agent.tokenId}/manage`)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    {!agent.isListed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/agents/${agent.tokenId}/list`)}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </Button>
                    )}
                  </CardFooter>
                </>
              ) : (
                /* List View */
                <div className="flex items-center p-6 gap-6">
                  <img
                    src={agent.image}
                    alt={agent.name}
                    className="w-16 h-16 rounded-full bg-gray-700 p-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {agent.model}
                      </Badge>
                      {agent.isListed && (
                        <Badge className="bg-green-600 text-xs">Listed</Badge>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{agent.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map((cap, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/chat/${agent.tokenId}`)}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/agents/${agent.tokenId}/manage`)}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      {agents.length > 0 && (
        <div className="mt-12 grid md:grid-cols-4 gap-4">
          <Card className="bg-gray-800/50 border-gray-700 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{agents.length}</div>
              <div className="text-sm text-gray-400">Total Agents</div>
            </div>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {agents.filter(a => a.isListed).length}
              </div>
              <div className="text-sm text-gray-400">Listed</div>
            </div>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {agents.filter(a => !a.isListed).length}
              </div>
              <div className="text-sm text-gray-400">Private</div>
            </div>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">
                {[...new Set(agents.map(a => a.model))].length}
              </div>
              <div className="text-sm text-gray-400">Models Used</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}