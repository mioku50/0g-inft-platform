/**
 * Client-side broker for non-custodial 0G Compute operations
 * Uses injected wallet (MetaMask, WalletConnect, etc.) via ethers BrowserProvider
 */

import { ethers, BrowserProvider } from 'ethers'

let cachedBroker: any = null
let cachedAddress: string | null = null

/**
 * Get or create a client-side broker instance using the injected wallet
 * This is a singleton that reinitializes when the wallet address changes
 */
export async function getClientBroker() {
  try {
    // Check if we have an injected wallet
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No injected wallet found. Please install MetaMask or connect a wallet.')
    }

    // Create browser provider
    const provider = new BrowserProvider(window.ethereum)
    
    // Get the signer and current address
    const signer = await provider.getSigner()
    const currentAddress = await signer.getAddress()

    // Return cached broker if address hasn't changed
    if (cachedBroker && cachedAddress === currentAddress) {
      return cachedBroker
    }

    // Dynamically import the broker function to avoid build issues
    const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker')

    // Create new broker instance
    console.log('[ClientBroker] Creating new broker for address:', currentAddress)
    const broker = await createZGComputeNetworkBroker(signer)

    // Cache the broker and address
    cachedBroker = broker
    cachedAddress = currentAddress

    return broker
  } catch (error) {
    console.error('[ClientBroker] Failed to create broker:', error)
    throw new Error(`Failed to initialize client broker: ${(error as Error).message}`)
  }
}

/**
 * Clear cached broker (useful when wallet disconnects or changes)
 */
export function clearBrokerCache() {
  cachedBroker = null
  cachedAddress = null
}

/**
 * Check if client broker is available (wallet connected)
 */
export async function isClientBrokerAvailable(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false
    }

    const provider = new BrowserProvider(window.ethereum)
    const accounts = await provider.listAccounts()
    return accounts.length > 0
  } catch {
    return false
  }
}

/**
 * Get current wallet address if available
 */
export async function getCurrentWalletAddress(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null
    }

    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    return await signer.getAddress()
  } catch {
    return null
  }
}