// web/app/api/agents/list/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { RPC_URL } from '@/lib/server/compute-env'
import { INFT_ABI } from '@/lib/contracts/abis'
import { agentCache, CacheKeys } from '@/lib/cache/agent-cache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get('owner')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    
    // Проверяем кеш
    const cacheKey = owner ? `${CacheKeys.AGENT_LIST}_${owner}_${page}` : `${CacheKeys.AGENT_LIST}_all_${page}`
    const cached = agentCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
      INFT_ABI,
      provider
    )
    
    let tokenIds: string[] = []
    
    if (owner) {
      // Получаем токены владельца
      const balance = await contract.balanceOf(owner)
      const start = (page - 1) * limit
      const end = Math.min(start + limit, Number(balance))
      
      for (let i = start; i < end; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(owner, i)
        tokenIds.push(tokenId.toString())
      }
    } else {
      // Получаем все токены с пагинацией
      const totalSupply = await contract.totalSupply()
      const start = (page - 1) * limit
      const end = Math.min(start + limit, Number(totalSupply))
      
      for (let i = start; i < end; i++) {
        const tokenId = await contract.tokenByIndex(i)
        tokenIds.push(tokenId.toString())
      }
    }
    
    // Получаем базовую информацию параллельно
    const agents = await Promise.all(
      tokenIds.map(async (tokenId) => {
        try {
          const [owner, metadataHash] = await Promise.all([
            contract.ownerOf(tokenId),
            contract.getEncryptedURI(tokenId)
          ])
          
          return {
            tokenId,
            owner,
            metadataHash,
            // Метаданные загрузим отдельно
            metadata: null
          }
        } catch (error) {
          console.error(`Error loading token ${tokenId}:`, error)
          return null
        }
      })
    )
    
    const result = {
      agents: agents.filter(Boolean),
      page,
      limit,
      hasMore: tokenIds.length === limit
    }
    
    // Кешируем результат
    agentCache.set(cacheKey, result)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('List agents error:', error)
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
  }
}