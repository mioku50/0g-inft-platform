// lib/constants.ts

export const NATIVE_SYMBOL = 'OG'
export const CHAIN_ID = 16601

import { parseEther, formatEther } from 'ethers'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing env ${name}`)
  }
  return v
}


export const toWei = (v: string | number | bigint) => parseEther(String(v))
export const fromWei = (v: any) => formatEther(BigInt(v?.toString?.() ?? v ?? 0n))
