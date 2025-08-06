/**
 * Ledger management utilities for non-custodial compute
 * Handles ledger account creation and validation with user-friendly UI feedback
 */

import { ethers } from 'ethers'
import { getClientBroker, getCurrentWalletAddress } from './clientBroker'

export interface LedgerStatus {
  exists: boolean
  balance: string
  address: string | null
  needsCreation: boolean
  error?: string
}

/**
 * Check if user has a ledger account and return its status
 */
export async function checkLedgerStatus(): Promise<LedgerStatus> {
  try {
    const address = await getCurrentWalletAddress()
    if (!address) {
      return {
        exists: false,
        balance: '0',
        address: null,
        needsCreation: true,
        error: 'No wallet connected'
      }
    }

    const broker = await getClientBroker()
    
    // Check if ledger account exists
    try {
      const ledgerInfo = await broker.ledger.getLedger(address)
      
      // Parse balance (SDK returns in wei, convert to OG)
      const balanceWei = ledgerInfo.ledgerInfo ? ledgerInfo.ledgerInfo[0] : ledgerInfo[0]
      const balanceOG = parseFloat(ethers.formatEther(balanceWei.toString())).toFixed(6)
      
      return {
        exists: true,
        balance: balanceOG,
        address,
        needsCreation: false
      }
    } catch (error) {
      // If getLedger fails, account doesn't exist
      if ((error as Error).message?.includes('not found') || (error as Error).message?.includes('does not exist')) {
        return {
          exists: false,
          balance: '0',
          address,
          needsCreation: true
        }
      }
      throw error
    }
  } catch (error) {
    console.error('[EnsureLedger] Failed to check ledger status:', error)
    return {
      exists: false,
      balance: '0',
      address: null,
      needsCreation: true,
      error: (error as Error).message
    }
  }
}

export interface CreateLedgerOptions {
  initialDeposit?: number // In OG tokens, default 0 (free account creation)
  onProgress?: (step: string) => void
}

/**
 * Create a new ledger account for the connected wallet
 * Shows progress and handles the transaction flow
 */
export async function createLedgerAccount(options: CreateLedgerOptions = {}): Promise<boolean> {
  const { initialDeposit = 0, onProgress } = options

  try {
    onProgress?.('Initializing ledger account...')
    
    const broker = await getClientBroker()
    const address = await getCurrentWalletAddress()
    
    if (!address) {
      throw new Error('No wallet connected')
    }

    onProgress?.('Creating ledger account on blockchain...')
    
    if (initialDeposit > 0) {
      // Create account with initial deposit
      await broker.ledger.depositFund(initialDeposit)
      onProgress?.(`Account created with ${initialDeposit} OG deposit`)
    } else {
      // Create account without deposit (if supported by SDK)
      await broker.ledger.addLedger(0)
      onProgress?.('Account created successfully')
    }

    return true
  } catch (error) {
    console.error('[EnsureLedger] Failed to create account:', error)
    onProgress?.(`Failed: ${(error as Error).message}`)
    return false
  }
}

export interface DepositOptions {
  amount: number // In OG tokens
  onProgress?: (step: string) => void
}

/**
 * Deposit funds to existing ledger account
 */
export async function depositToLedger(options: DepositOptions): Promise<boolean> {
  const { amount, onProgress } = options

  try {
    onProgress?.(`Depositing ${amount} OG...`)
    
    const broker = await getClientBroker()
    await broker.ledger.depositFund(amount)
    
    onProgress?.(`Successfully deposited ${amount} OG`)
    return true
  } catch (error) {
    console.error('[EnsureLedger] Failed to deposit:', error)
    onProgress?.(`Deposit failed: ${(error as Error).message}`)
    return false
  }
}

/**
 * Ensure user has a ledger account, create one if needed
 * Returns true if account exists/created, false if user declined
 */
export async function ensureLedgerAccount(
  options: CreateLedgerOptions = {},
  showModal: (status: LedgerStatus) => Promise<boolean> = defaultLedgerModal
): Promise<boolean> {
  const status = await checkLedgerStatus()
  
  if (status.exists) {
    return true
  }

  // Show modal for user to decide
  const userConsent = await showModal(status)
  if (!userConsent) {
    return false
  }

  // Create the account
  return createLedgerAccount(options)
}

/**
 * Default modal implementation (to be replaced by UI components)
 * This is a fallback that uses browser confirm dialog
 */
async function defaultLedgerModal(status: LedgerStatus): Promise<boolean> {
  if (status.error) {
    alert(`Error: ${status.error}`)
    return false
  }

  return confirm(
    `You need a 0G Compute ledger account to use AI services.\n\n` +
    `Current wallet: ${status.address}\n` +
    `Create account now? (0 OG cost)`
  )
}

// Remove the duplicate ethers export since it's already imported at the top