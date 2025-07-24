// lib/constants.ts

export const NATIVE_SYMBOL = 'OG'
export const CHAIN_ID = 16601

import { parseEther, formatEther } from 'ethers'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export const RPC_URL = requireEnv('NEXT_PUBLIC_0G_RPC_URL')
export const FINE_TUNING_SERVING = requireEnv('NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS')
export const FINE_TUNE_PROVIDER = requireEnv('NEXT_PUBLIC_FINE_TUNE_PROVIDER')
export const PK = requireEnv('OG_COMPUTE_PRIVATE_KEY')

export const toWei = (v: string | number | bigint) => parseEther(String(v))
export const fromWei = (v: any) => formatEther(BigInt(v?.toString?.() ?? v ?? 0n))
