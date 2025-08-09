import { ethers } from 'ethers'

/**
 * Ensures amount is a valid BigInt for ledger operations
 * @param amount - Amount in OG as string, number, or BigInt
 * @returns BigInt amount in wei
 */
export function ensureWeiAmount(amount: string | number | bigint): bigint {
  if (typeof amount === 'bigint') {
    return amount
  }
  
  if (typeof amount === 'number') {
    console.warn('[LedgerUtils] Number passed to ledger method, converting to wei. Use parseEther() instead.')
    return ethers.parseEther(amount.toString())
  }
  
  if (typeof amount === 'string') {
    // Validate string format
    const regex = /^\d+(\.\d{0,18})?$/
    if (!regex.test(amount)) {
      throw new Error(`Invalid amount format: ${amount}. Expected decimal with up to 18 places.`)
    }
    return ethers.parseEther(amount)
  }
  
  throw new Error(`Invalid amount type: ${typeof amount}. Expected string, number, or bigint.`)
}

/**
 * Safe wrapper for addLedger that ensures BigInt
 */
export async function safeAddLedger(broker: any, amount: string | number | bigint) {
  const weiAmount = ensureWeiAmount(amount)
  console.log(`[LedgerUtils] addLedger with ${ethers.formatEther(weiAmount)} OG (${weiAmount} wei)`)
  return broker.ledger.addLedger(weiAmount)
}

/**
 * Safe wrapper for depositFund that ensures BigInt
 */
export async function safeDepositFund(broker: any, amount: string | number | bigint) {
  const weiAmount = ensureWeiAmount(amount)
  console.log(`[LedgerUtils] depositFund with ${ethers.formatEther(weiAmount)} OG (${weiAmount} wei)`)
  return broker.ledger.depositFund(weiAmount)
}

/**
 * Safe wrapper for retrieveFund that ensures BigInt
 */
export async function safeRetrieveFund(broker: any, serviceType: 'inference' | 'fine-tuning', amount: string | number | bigint) {
  const weiAmount = ensureWeiAmount(amount)
  console.log(`[LedgerUtils] retrieveFund ${serviceType} with ${ethers.formatEther(weiAmount)} OG (${weiAmount} wei)`)
  return broker.ledger.retrieveFund(serviceType, weiAmount)
}

/**
 * Format balance from wei to OG string
 */
export function formatBalance(balanceWei: bigint | string, decimals: number = 6): string {
  const balanceOG = ethers.formatEther(balanceWei.toString())
  return parseFloat(balanceOG).toFixed(decimals)
}