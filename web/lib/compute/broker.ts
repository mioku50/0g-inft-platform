import 'dotenv/config'
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { create0GRateLimitedProvider } from '../server/rate-limited-provider'

let brokerInstance: any = null

function getBrowserWalletSigner(): ethers.Signer {
  // This would be implemented for non-custodial mode
  // For now, we'll fall back to server-side signer
  throw new Error('Non-custodial wallet not available on server side')
}

export async function getBroker() {
  if (brokerInstance) return brokerInstance
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not found')
  }
  
  const provider = create0GRateLimitedProvider()
  
  const USE_NONCUSTODIAL_INFERENCE = process.env.USE_NONCUSTODIAL_INFERENCE === 'true'
  
  const signer = USE_NONCUSTODIAL_INFERENCE
    ? getBrowserWalletSigner()
    : new ethers.Wallet(privateKey, provider) as any

  brokerInstance = await createZGComputeNetworkBroker(
    signer,
    process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT!,
    process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT!,
    process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS!
  )
  
  console.log('broker created')
  return brokerInstance
}
