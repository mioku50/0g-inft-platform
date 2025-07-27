import { ethers } from 'ethers'
import { CHAIN_ID } from './compute-env'
import { getRpcUrl } from './compute-env'

export function create0GProvider(): ethers.JsonRpcProvider {
  const provider = new ethers.JsonRpcProvider(getRpcUrl(), { name: '0g', chainId: CHAIN_ID })
  ;(provider as any).resolveName = async () => null
  return provider
}
