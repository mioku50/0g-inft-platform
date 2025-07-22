import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

let broker: any

export async function getBroker() {
  if (broker) return broker

  const rpc = process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpc) throw new Error('NEXT_PUBLIC_OG_RPC missing')
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)
  broker = await createZGComputeNetworkBroker(wallet)
  return broker
}
