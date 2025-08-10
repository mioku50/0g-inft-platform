'use client'

/**
 * Client-side broker for non-custodial 0G Compute operations
 * Uses injected wallet (MetaMask, WalletConnect, etc.) via ethers BrowserProvider
 */

// Only import ethers statically as it's safe for SSR
import { BrowserProvider } from 'ethers'
import { BROKER_LOG, LEDGER_LOG } from '@/lib/utils/log'

// Broker module cache
let BrokerMod: any | null = null

async function loadSdk() {
  if (BrokerMod) return BrokerMod
  if (typeof window === 'undefined') throw new Error('Broker must run in browser')
  try {
    BrokerMod = await import('@0glabs/0g-serving-broker')
    return BrokerMod
  } catch (e: any) {
    console.error('[ClientBroker] import failed', e)
    // Пробрасываем оригинальное сообщение, иначе на UI виден только общий текст
    throw new Error(`@0glabs/0g-serving-broker import failed: ${e?.message || String(e)}`)
  }
}

// Broker cache by wallet address  
const brokerCache = new Map<string, any>()
let ethersModule: any = null

// Provider acknowledgment cache
const acknowledgeCache = new Map<string, number>()
const ACKNOWLEDGE_TTL_MIN = parseInt(process.env.NEXT_PUBLIC_BROKER_ACK_TTL_MIN || '30')
const ACKNOWLEDGE_TTL = ACKNOWLEDGE_TTL_MIN * 60 * 1000 // Convert to milliseconds

/**
 * Get ethers module dynamically to avoid SSR issues
 */
async function getEthers() {
  if (!ethersModule && typeof window !== 'undefined') {
    ethersModule = await import('ethers')
  }
  return ethersModule
}

/**
 * Get or create a client-side broker instance using the injected wallet
 * This is a singleton per wallet address
 */
export async function getClientBroker() {
  // SSR guard
  if (typeof window === 'undefined') {
    throw new Error('Broker must run in browser')
  }

  try {
    // Check if we have an injected wallet
    if (!(window as any).ethereum) {
      throw new Error('No injected wallet found. Please install MetaMask or connect a wallet.')
    }

    // Get ethers module
    const ethers = await getEthers()
    if (!ethers) {
      throw new Error('Failed to load ethers module')
    }

    // Create browser provider
    const provider = new BrowserProvider((window as any).ethereum)
    
    // Get the signer and current address
    const signer = await provider.getSigner()
    const currentAddress = await signer.getAddress()

    // Return cached broker if we have one for this address
    const cachedBroker = brokerCache.get(currentAddress)
    if (cachedBroker) {
      return cachedBroker
    }

    // Dynamically import the broker module with error handling
    const { createZGComputeNetworkBroker } = await loadSdk()

    // Create new broker instance
    BROKER_LOG('Creating new broker for address:', currentAddress)
    const broker = await createZGComputeNetworkBroker(signer)

    // Cache the broker by address
    brokerCache.set(currentAddress, broker)

    return broker
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ClientBroker] Failed to create broker:', error)
    throw new Error(`Failed to initialize client broker: ${(error as Error).message}`)
  }
}

/**
 * Clear cached broker for specific address or all
 */
export function clearBrokerCache(address?: string) {
  if (address) {
    brokerCache.delete(address)
  } else {
    brokerCache.clear()
  }
}

/**
 * Check if client broker is available (wallet connected)
 */
export async function isClientBrokerAvailable(): Promise<boolean> {
  // SSR guard
  if (typeof window === 'undefined') {
    return false
  }

  try {
    if (!(window as any).ethereum) {
      return false
    }

    const provider = new BrowserProvider((window as any).ethereum)
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
  // SSR guard
  if (typeof window === 'undefined') {
    return null
  }

  try {
    if (!(window as any).ethereum) {
      return null
    }

    const provider = new BrowserProvider((window as any).ethereum)
    const signer = await provider.getSigner()
    return await signer.getAddress()
  } catch {
    return null
  }
}

/**
 * Get ledger balance for the current user
 */
export async function getLedgerBalance(userAddress?: string): Promise<number> {
  try {
    const broker = await getClientBroker()
    const ledger = await broker.ledger.getLedger()
    const ethers = await getEthers()
    const balanceWei = ledger.balance
    const balanceOG = (ethers as any).formatEther(balanceWei)
    
    LEDGER_LOG('Ledger balance:', balanceOG, 'OG')
    return parseFloat(balanceOG) || 0
    
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[ClientBroker] Failed to get ledger balance:', error)
    // Return 0 if ledger doesn't exist or other error
    return 0
  }
}

/**
 * Ensure ledger exists for the current user
 * Creates a ledger account if it doesn't exist
 */
export async function ensureLedger(userAddress?: string): Promise<boolean> {
  try {
    const broker = await getClientBroker()
    const address = userAddress || (await getCurrentWalletAddress())
    
    if (!address) {
      throw new Error('No wallet address available')
    }

    LEDGER_LOG('Ensuring ledger for address:', address)
    
    // Check if ledger already exists
    try {
      const ledgerInfo = await broker.ledger.getLedger()
      if (ledgerInfo && ledgerInfo.balance) {
        LEDGER_LOG('Ledger already exists')
        return true
      }
    } catch (error) {
      // Ledger doesn't exist, we'll create it
      LEDGER_LOG('Ledger not found, creating new one')
    }

    // Create ledger with initial balance (0.01 OG)  
    const ethers = await getEthers()
    LEDGER_LOG('Creating new ledger with 0.01 OG initial balance...')
    await broker.ledger.addLedger((ethers as any).parseEther('0.01'))
    
    LEDGER_LOG('Ledger created successfully with balance: 0.01 OG')
    return true
    
  } catch (error) {
    // eslint-disable-next-line no-console
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
    
    BROKER_LOG('Preparing compute request for provider:', providerAddress)
    
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
    
    BROKER_LOG('Request prepared successfully')
    
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
    // eslint-disable-next-line no-console
    console.error('[ClientBroker] Failed to prepare request:', error)
    throw new Error(`Failed to prepare compute request: ${(error as Error).message}`)
  }
}

/**
 * Acknowledge provider if not already done (with caching)
 */
async function acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
  const now = Date.now()
  const lastAck = acknowledgeCache.get(providerAddress)
  
  if (lastAck && (now - lastAck) < ACKNOWLEDGE_TTL) {
    BROKER_LOG('Provider already acknowledged (cached)')
    return
  }
  
  try {
    BROKER_LOG('Acknowledging provider:', providerAddress)
    await broker.inference.acknowledgeProviderSigner(providerAddress)
    acknowledgeCache.set(providerAddress, now)
    BROKER_LOG('Provider acknowledged successfully')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[ClientBroker] Failed to acknowledge provider (may already be acknowledged):', (error as any)?.message || error)
    // Don't throw here as provider might already be acknowledged
  }
}