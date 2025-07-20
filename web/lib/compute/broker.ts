import 'dotenv/config'
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

let brokerInstance: any = null

export async function getBroker() {
  if (brokerInstance) return brokerInstance
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not found')
  }
  
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  const wallet = new ethers.Wallet(privateKey, provider)
  
  brokerInstance = await createZGComputeNetworkBroker(wallet)
  return brokerInstance
}
