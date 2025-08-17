// web/app/api/agents/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getRpcUrl } from '@/lib/server/compute-env'
import { INFT_ABI } from '@/lib/contracts/abis'
import { agentCache, CacheKeys } from '@/lib/cache/agent-cache'
import { 
  staticCallSafe, 
  withRetry, 
  batchContractCalls, 
  loadTokenMetadataSafe 
} from '@/lib/chain/eth'
import enhancedProvider from '@/lib/chain/provider'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get('owner')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const size = parseInt(searchParams.get('size') || '20', 10)
    
    // Validate pagination parameters
    if (page < 1 || size < 1 || size > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' }, 
        { status: 400 }
      )
    }
    
    console.log(`[agents/list] Loading page ${page}, size ${size}, owner: ${owner || 'all'}`)
    
    // Check cache first
    const cacheKey = owner 
      ? `${CacheKeys.AGENT_LIST}_${owner}_${page}_${size}` 
      : `${CacheKeys.AGENT_LIST}_all_${page}_${size}`
    
    const cached = agentCache.get(cacheKey)
    if (cached) {
      console.log(`[agents/list] Cache hit for ${cacheKey}`)
      return NextResponse.json(cached)
    }
    
    // Initialize contract with enhanced provider
    const provider = enhancedProvider.getProvider()
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
      INFT_ABI,
      provider
    )
    
    // Get token IDs with batching and error handling
    const tokenIds = await withRetry(async () => {
      if (owner) {
        return await getTokensByOwner(contract, owner, page, size)
      } else {
        return await getAllTokens(contract, page, size)
      }
    })

    console.log(`[agents/list] Found ${tokenIds.length} token IDs`)
    
    if (tokenIds.length === 0) {
      const result = {
        items: [],
        page,
        size,
        totalFound: 0,
        hasMore: false
      }
      
      // Cache empty results for shorter time
      agentCache.set(cacheKey, result, 2 * 60 * 1000) // 2 minutes
      return NextResponse.json(result)
    }

    // Load token metadata with enhanced batching
    const metadataLoaders = tokenIds.map(tokenId => 
      () => loadTokenMetadataSafe(contract, tokenId)
    )
    
    const agents = await batchContractCalls(metadataLoaders, {
      batchSize: 4, // Reduced batch size to be gentler on RPC
      delayBetweenBatches: 300 // 300ms between batches
    })
    
    // Filter out failed loads but keep partial data
    const validAgents = agents.filter(agent => agent && agent.id)
    
    const result = {
      items: validAgents,
      page,
      size,
      totalFound: validAgents.length,
      hasMore: tokenIds.length === size // Indicates there might be more
    }
    
    // Cache results for 10 minutes
    agentCache.set(cacheKey, result, 10 * 60 * 1000)
    
    console.log(`[agents/list] Returning ${validAgents.length} agents (${tokenIds.length - validAgents.length} failed to load)`)
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('[agents/list] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to load agents',
        details: error.message,
        items: [],
        page: parseInt(new URL(request.url).searchParams.get('page') || '1', 10),
        size: parseInt(new URL(request.url).searchParams.get('size') || '20', 10),
        totalFound: 0,
        hasMore: false
      }, 
      { status: 500 }
    )
  }
}

/**
 * Get tokens by owner with safe pagination
 */
async function getTokensByOwner(
  contract: ethers.Contract, 
  owner: string, 
  page: number, 
  size: number
): Promise<string[]> {
  const balance = await staticCallSafe(contract, 'balanceOf', owner)
  
  if (!balance || Number(balance) === 0) {
    return []
  }
  
  const totalBalance = Number(balance)
  const start = (page - 1) * size
  const end = Math.min(start + size, totalBalance)
  
  if (start >= totalBalance) {
    return []
  }
  
  console.log(`[getTokensByOwner] Loading tokens ${start} to ${end-1} of ${totalBalance}`)
  
  // Create batch calls for tokenOfOwnerByIndex
  const tokenCalls = []
  for (let i = start; i < end; i++) {
    tokenCalls.push(() => staticCallSafe(contract, 'tokenOfOwnerByIndex', owner, i))
  }
  
  const tokens = await batchContractCalls(tokenCalls)
  
  // Filter out null results and convert to strings
  return tokens
    .filter(token => token !== null)
    .map(token => token.toString())
}

/**
 * Get all tokens with safe pagination using totalSupply
 */
async function getAllTokens(
  contract: ethers.Contract, 
  page: number, 
  size: number
): Promise<string[]> {
  const totalSupply = await staticCallSafe(contract, 'totalSupply')
  
  if (!totalSupply || Number(totalSupply) === 0) {
    return []
  }
  
  const total = Number(totalSupply)
  const start = (page - 1) * size
  const end = Math.min(start + size, total)
  
  if (start >= total) {
    return []
  }
  
  console.log(`[getAllTokens] Loading tokens ${start} to ${end-1} of ${total}`)
  
  // Create batch calls for tokenByIndex
  const tokenCalls = []
  for (let i = start; i < end; i++) {
    tokenCalls.push(() => staticCallSafe(contract, 'tokenByIndex', i))
  }
  
  const tokens = await batchContractCalls(tokenCalls)
  
  // Filter out null results and convert to strings
  return tokens
    .filter(token => token !== null)
    .map(token => token.toString())
}