import { ethers } from 'ethers'
import { WalletClient } from 'viem'

/**
 * Converts a wagmi WalletClient to an ethers Signer
 * This is needed for compatibility with ethers-based libraries
 */
export async function walletClientToSigner(walletClient: WalletClient): Promise<ethers.Signer> {
  if (!walletClient) {
    throw new Error('WalletClient is required')
  }

  // Create a provider from the wallet client's transport
  const provider = new ethers.BrowserProvider(walletClient.transport as any)
  
  // Return a signer for the connected account
  return await provider.getSigner()
}

/**
 * Check if wallet client is available and connected
 */
export function isWalletConnected(walletClient?: WalletClient): boolean {
  return !!(walletClient && walletClient.account)
}