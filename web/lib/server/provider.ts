import { ethers } from 'ethers'
import { CHAIN_ID } from './compute-env'
import { getRpcUrl } from './compute-env'
import { getRateLimitedProvider } from './rate-limited-provider'

export function create0GProvider(): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(getRpcUrl(), { name: '0g', chainId: CHAIN_ID })
  ;(provider as any).resolveName = async () => null
  return provider
}

// Use rate-limited provider for compute operations
export function create0GRateLimitedProvider(): ethers.JsonRpcProvider {
  return getRateLimitedProvider()
}

let cached: ethers.JsonRpcProvider | null = null
export function getProvider(): ethers.JsonRpcProvider {
  if (!cached) cached = create0GProvider()
  return cached
}

let rateLimitedCached: ethers.JsonRpcProvider | null = null
export function getRateLimitedCachedProvider(): ethers.JsonRpcProvider {
  if (!rateLimitedCached) rateLimitedCached = create0GRateLimitedProvider()
  return rateLimitedCached
}
