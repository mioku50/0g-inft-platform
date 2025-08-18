import 'dotenv/config'
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { getRateLimitedProvider } from '../server/rate-limited-provider'

// Cache with user isolation
const brokerCache = new Map<string, { broker: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Official contract addresses from .env.local
const OFFICIAL_CONTRACTS = {
  ledger: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT || '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  inference: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT || '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
  fineTuning: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS || '0xda478Ccf5d534346A16b1475E4c2DecE0268B176'
}

export async function getBroker(userAddress?: string) {
  const cacheKey = userAddress ? `${userAddress}` : 'default'
  
  // Check cache
  const cached = brokerCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.broker
  }
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not found')
  }
  
  try {
    // Use rate-limited provider
    const provider = getRateLimitedProvider()
    const wallet = new ethers.Wallet(privateKey, provider)
    
    // Test network connectivity first
    const network = await provider.getNetwork()
    console.log(`Connected to network: chainId=${network.chainId}`)
    
    // Create broker with explicit contract addresses
    const broker = await createZGComputeNetworkBroker(
      wallet,
      OFFICIAL_CONTRACTS.ledger,
      OFFICIAL_CONTRACTS.inference,
      OFFICIAL_CONTRACTS.fineTuning
    )
    
    // Cache the broker
    brokerCache.set(cacheKey, { broker, timestamp: Date.now() })
    
    // Clean old cache entries
    cleanCache()
    
    return broker
  } catch (error: any) {
    console.error('Failed to create broker:', error.message)
    throw new Error(`Broker initialization failed: ${error.message}`)
  }
}

function cleanCache() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  brokerCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => brokerCache.delete(key))
}

export { OFFICIAL_CONTRACTS }
