import { ethers } from 'ethers'
import { create0GRateLimitedProvider } from './rate-limited-provider'

let provider: ethers.JsonRpcProvider | null = null

export function getServerProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = create0GRateLimitedProvider()
  }
  return provider
}
