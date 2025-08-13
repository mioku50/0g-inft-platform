'use client'

import { BrowserProvider } from 'ethers'
import { BROKER_LOG } from '@/lib/utils/log'

const G = globalThis as any
let sdkPromise: Promise<any> | null = null

export async function loadSdk() {
  if (typeof window === 'undefined') {
    throw new Error('Broker SDK must run in the browser')
  }
  if (G.__OG_BROKER_SDK__) return G.__OG_BROKER_SDK__
  if (sdkPromise) return sdkPromise

  sdkPromise = import('@0glabs/0g-serving-broker').then((mod: any) => {
    if (typeof mod?.createZGComputeNetworkBroker !== 'function') {
      throw new Error('SDK import ok but required export missing')
    }
    G.__OG_BROKER_SDK__ = mod
    BROKER_LOG('SDK loaded (real)')
    return mod
  })

  return sdkPromise
}

export async function getClientBroker() {
  if (typeof window === 'undefined') throw new Error('Broker must run in browser')
  if (!(window as any).ethereum) throw new Error('No injected wallet found')

  // Валидация ethers в браузере
  if (typeof (BrowserProvider as any) !== 'function') {
    throw new Error('Ethers BrowserProvider not available')
  }

  const { createZGComputeNetworkBroker } = await loadSdk()
  const provider = new BrowserProvider((window as any).ethereum)
  const signer = await provider.getSigner()
  return await createZGComputeNetworkBroker(signer)
}

// На всякий случай экспорт очистки кэша
export function clearBrokerCache() {
  delete (globalThis as any).__OG_BROKER_SDK__
  sdkPromise = null
}

/**
 * Check if client broker is available (wallet connected)
 */
export async function isClientBrokerAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  try {
    if (!(window as any).ethereum) return false

    const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) && accounts.length > 0;
  } catch {
    return false
  }
}

/**
 * Get current wallet address if available
 */
export async function getCurrentWalletAddress(): Promise<string | null> {
  if (typeof window === 'undefined') return null

  try {
    if (!(window as any).ethereum) return null

    const provider = new BrowserProvider((window as any).ethereum)
    const signer = await provider.getSigner()
    return await signer.getAddress()
  } catch {
    return null
  }
}

/**
 * Ensure ledger exists for the current user
 */
export async function ensureLedger(): Promise<boolean> {
  try {
    const broker = await getClientBroker()
    const ledgerInfo = await broker.ledger.getLedger()
    return true // If we get here, ledger exists
  } catch {
    return false // Ledger doesn't exist or other error
  }
}

/**
 * Prepare a compute request with client-side signing
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
  const broker = await getClientBroker()
  
  // Get service metadata
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
  
  // Prepare the message content for billing
  const content = typeof payload === 'object' && payload.messages 
    ? payload.messages.map((m: any) => m.content).join(' ')
    : JSON.stringify(payload)
  
  // Get request headers with billing information
  const headers = await broker.inference.getRequestHeaders(providerAddress, content)
  
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
}

/**
 * Setup wallet event listeners for automatic cache clearing
 */
export function setupWalletEventListeners() {
  if (typeof window === 'undefined') return;
  
  const ethereum = (window as any).ethereum;
  if (!ethereum) return;

  // Remove existing listeners to avoid duplicates
  ethereum.removeAllListeners?.('accountsChanged');
  ethereum.removeAllListeners?.('chainChanged');
  
  // Add new listeners
  ethereum.on?.('accountsChanged', () => {
    clearBrokerCache();
  });
  
  ethereum.on?.('chainChanged', () => {
    clearBrokerCache();
  });
}