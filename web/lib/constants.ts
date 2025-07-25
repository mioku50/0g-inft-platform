// lib/constants.ts

export const NATIVE_SYMBOL = 'OG'
export const CHAIN_ID = 16601

import { parseEther, formatEther } from 'ethers'

export function requireEnv(name: string): string {
  const v = process.env[name]
  
  // Во время build (когда нет реального окружения) используем fallback значения
  if (!v) {
    const fallbacks: Record<string, string> = {
      'NEXT_PUBLIC_0G_RPC_URL': 'https://evmrpc-testnet.0g.ai',
      'NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS': '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
      'NEXT_PUBLIC_FINE_TUNE_PROVIDER': '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      'OG_COMPUTE_PRIVATE_KEY': '0x0000000000000000000000000000000000000000000000000000000000000001'
    }
    
    if (fallbacks[name]) {
      console.warn(`Warning: Missing env ${name}, using fallback`)
      return fallbacks[name]
    }
    
    throw new Error(`Missing env ${name}`)
  }
  
  return v
}


export const toWei = (v: string | number | bigint) => parseEther(String(v))
export const fromWei = (v: any) => formatEther(BigInt(v?.toString?.() ?? v ?? 0n))
