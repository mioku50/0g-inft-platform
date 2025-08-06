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

/**
 * Ensure ledger exists for the current user
 * Creates a ledger account if it doesn't exist
 */
export async function ensureLedger(userAddress?: string): Promise<boolean> {
  try {
    const broker = await getClientBroker()
    const address = userAddress || await getCurrentWalletAddress()
    
    if (!address) {
      throw new Error('No wallet address available')
    }

    console.log('[ClientBroker] Ensuring ledger for address:', address)
    
    // Check if ledger already exists
    try {
      const ledgerInfo = await broker.ledger.getLedgerInfo()
      if (ledgerInfo && ledgerInfo.length > 0) {
        console.log('[ClientBroker] Ledger already exists')
        return true
      }
    } catch (error) {
      // Ledger doesn't exist, we'll create it
      console.log('[ClientBroker] Ledger not found, creating new one')
    }

    // Create ledger with initial balance (0.01 ETH = 10000000000000000 wei)
    const initialBalance = 0.01
    await broker.ledger.addLedger(initialBalance)
    
    console.log('[ClientBroker] Ledger created successfully with balance:', initialBalance)
    return true
    
  } catch (error) {
    console.error('[ClientBroker] Failed to ensure ledger:', error)
    throw new Error(`Failed to ensure ledger: ${(error as Error).message}`)
  }
}

/**
 * Prepare a compute request with client-side signing
 * Returns prepared request data that can be sent to the proxy
 */
export async function prepareComputeRequest(
  providerAddress: string, 
  payload: any
): Promise<{
  endpoint: string
  method: string
  headers: Record<string, string>
  body: string
}> {
  try {
    const broker = await getClientBroker()
    
    console.log('[ClientBroker] Preparing compute request for provider:', providerAddress)
    
    // Acknowledge provider if not already done (cached for 30 min)
    await acknowledgeProviderIfNeeded(broker, providerAddress)
    
    // Get service metadata
    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
    
    // Prepare the message content for billing
    const content = typeof payload === 'object' && payload.messages 
      ? payload.messages.map((m: any) => m.content).join(' ')
      : JSON.stringify(payload)
    
    // Get request headers with billing information
    const headers = await broker.inference.getRequestHeaders(providerAddress, content)
    
    console.log('[ClientBroker] Request prepared successfully')
    
    return {
      endpoint: `${endpoint}/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        ...payload,
        model: model
      })
    }
    
  } catch (error) {
    console.error('[ClientBroker] Failed to prepare request:', error)
    throw new Error(`Failed to prepare compute request: ${(error as Error).message}`)
  }
}

/**
 * Get ledger balance for the current user
 */
export async function getLedgerBalance(userAddress?: string): Promise<number> {
  try {
    const broker = await getClientBroker()
    const balance = await broker.ledger.getBalance()
    
    console.log('[ClientBroker] Ledger balance:', balance)
    return parseFloat(balance) || 0
    
  } catch (error) {
    console.error('[ClientBroker] Failed to get ledger balance:', error)
    // Return 0 if ledger doesn't exist or other error
    return 0
  }
}

/**
 * Check if ledger exists for the current user
 */
export async function checkLedgerExists(): Promise<boolean> {
  try {
    const broker = await getClientBroker()
    const ledgerInfo = await broker.ledger.getLedgerInfo()
    return ledgerInfo && ledgerInfo.length > 0
  } catch (error) {
    console.log('[ClientBroker] Ledger check failed - probably does not exist:', error)
    return false
  }
}

/**
 * Acknowledge provider if not already done (with caching)
 */
async function acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
  const now = Date.now()
  const lastAck = acknowledgeCache.get(providerAddress)
  
  if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
    console.log('[ClientBroker] Provider already acknowledged (cached)')
    return
  }
  
  try {
    console.log('[ClientBroker] Acknowledging provider:', providerAddress)
    await broker.inference.acknowledgeProviderSigner(providerAddress)
    acknowledgeCache.set(providerAddress, now)
    console.log('[ClientBroker] Provider acknowledged successfully')
  } catch (error) {
    console.warn('[ClientBroker] Failed to acknowledge provider (may already be acknowledged):', error)
    // Don't throw here as provider might already be acknowledged
  }
}