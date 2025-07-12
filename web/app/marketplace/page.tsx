'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  ShoppingCart,
  Search,
  Filter,
  TrendingUp,
  Clock,
  DollarSign,
  Bot,
  Sparkles,
  Eye,
  Heart
} from 'lucide-react'
import { formatEther } from 'viem'

interface MarketplaceAgent {
  tokenId: string
  name: string
  description: string
  model: string
  capabilities: string[]
  image: string
  price: bigint
  seller: string
  listingTime: Date
  views: number
  likes: number
}

export default function MarketplacePage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [agents, setAgents] = useState<MarketplaceAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'price-low' | 'price-high' | 'popular'>('recent')
  const [priceRange, setPriceRange] = useState([0, 100])
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Mock data for demo
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const mockListings: MarketplaceAgent[] = [
          {
            tokenId: '2',
            name: 'Creative Writer Elite',
            description: 'Advanced AI specialized in creative writing, storytelling, and content generation',
            model: 'Claude 3',
            capabilities: ['creative writing', 'storytelling', 'editing', 'translation'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=2',
            price: BigInt('10000000000000000'), // 0.01 ETH
            seller: '0x1234...5678',
            listingTime: new Date(Date.now() - 86400000),
            views: 245,
            likes: 18
          },
          {
            tokenId: '5',
            name: 'DeFi Analytics Pro',
            description: 'Specialized in DeFi protocol analysis and yield optimization strategies',
            model: 'GPT-4',
            capabilities: ['defi analysis', 'yield farming', 'risk assessment'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=5',
            price: BigInt('50000000000000000'), // 0.05 ETH
            seller: '0xabcd...efgh',
            listingTime: new Date(Date.now() - 172800000),
            views: 512,
            likes: 42
          },
          {
            tokenId: '8',
            name: 'Code Review Master',
            description: 'Expert code reviewer with support for 20+ programming languages',
            model: 'Custom Model',
            capabilities: ['code review', 'security audit', 'optimization'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=8',
            price: BigInt('25000000000000000'), // 0.025 ETH
            seller: '0x9876...5432',
            listingTime: new Date(Date.now() - 3600000),
            views: 89,
            likes: 7
          },
          {
            tokenId: '12',
            name: 'Marketing Strategist AI',
            description: 'Complete marketing automation and strategy development',
            model: 'GPT-4',
            capabilities: ['marketing', 'seo', 'content strategy', 'analytics'],
            image: 'https://api.dicebear.com/7.x/bottts/svg?seed=12',
            price: BigInt('30000000000000000'), // 0.03 ETH
            seller: '0x5555...6666',
            listingTime: new Date(Date.now() - 7200000),
            views: 167,
            likes: 23
          }
        ]
        
        setAgents(mockListings)
      } catch (error) {
        console.error('Failed to fetch listings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchListings()
  }, [])

  // Filter and sort agents
  const filteredAgents = agents
    .filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesModel = selectedModel === 'all' || agent.model === selectedModel
      
      const priceInEth = Number(formatEther(agent.price))
      const matchesPrice = priceInEth >= priceRange[0] / 100 && priceInEth <= priceRange[1] / 100
      
      return matchesSearch && matchesModel && matchesPrice
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return Number(a.price - b.price)
        case 'price-high':
          return Number(b.price - a.price)
        case 'popular':
          return b.views - a.views
        case 'recent':
        default:
          return b.listingTime.getTime() - a.listingTime.getTime()
      }
    })

  const models = ['all', ...new Set(agents.map(a => a.model))]

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <Skeleton className="h-32 w-full rounded-lg mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
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
        <h1 className="text-4xl font-bold text-white mb-2">AI Agent Marketplace</h1>
        <p className="text-gray-400">Discover and acquire powerful AI agents</p>
      </div>

      {/* Featured Stats */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-300">Total Listed</p>
                <p className="text-2xl font-bold text-white">{agents.length}</p>
              </div>
              <Bot className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border-blue-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-300">Avg Price</p>
                <p className="text-2xl font-bold text-white">
                  {agents.length > 0 
                    ? (agents.reduce((sum, a) => sum + Number(formatEther(a.price)), 0) / agents.length).toFixed(3)
                    : '0'} ETH
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-300">New Today</p>
                <p className="text-2xl font-bold text-white">
                  {agents.filter(a => Date.now() - a.listingTime.getTime() < 86400000).length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-300">Most Popular</p>
                <p className="text-lg font-bold text-white truncate">
                  {agents.sort((a, b) => b.views - a.views)[0]?.name || 'N/A'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search AI agents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-gray-700"
            />
          </div>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-[180px] bg-gray-900/50 border-gray-700">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Listed</SelectItem>
              <SelectItem value="price-low">Price: Low to High</SelectItem>
              <SelectItem value="price-high">Price: High to Low</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="border-gray-700"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="bg-gray-800/50 border-gray-700 p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">AI Model</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="bg-gray-900/50 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(model => (
                      <SelectItem key={model} value={model}>
                        {model === 'all' ? 'All Models' : model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">
                  Price Range: {priceRange[0] / 100} - {priceRange[1] / 100} ETH
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={0}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Agents Grid */}
      {filteredAgents.length === 0 ? (
        <Card className="bg-gray-800/50 border-gray-700 text-center py-20">
          <CardContent>
            <Search className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No agents found
            </h3>
            <p className="text-gray-400">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAgents.map((agent) => (
            <Card
              key={agent.tokenId}
              className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-all duration-300 overflow-hidden group"
            >
              <CardHeader>
                <div className="relative h-32 bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-lg mb-4 flex items-center justify-center">
                  <img
                    src={agent.image}
                    alt={agent.name}
                    className="w-20 h-20 group-hover:scale-110 transition-transform duration-300"
                  />
                  <Badge className="absolute top-2 right-2 bg-purple-600">
                    {agent.model}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{agent.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-4">
                  {agent.capabilities.slice(0, 2).map((cap, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
                  {agent.capabilities.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{agent.capabilities.length - 2}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {agent.views}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    {agent.likes}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor((Date.now() - agent.listingTime.getTime()) / 3600000)}h
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Price</p>
                  <p className="text-lg font-bold text-white">
                    {formatEther(agent.price)} ETH
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push(`/marketplace/${agent.tokenId}`)}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  View
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}