import { Wallet, JsonRpcProvider } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

let broker: any

export async function getBroker() {
  if (broker) return broker

  const rpc = process.env.NEXT_PUBLIC_0G_RPC || process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpc) throw new Error('NEXT_PUBLIC_0G_RPC missing')
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  const signer = new Wallet(pk, new JsonRpcProvider(rpc))
  broker = await createZGComputeNetworkBroker(signer)
  if (broker.fineTuning && !broker.tasks) {
    broker.tasks = broker.fineTuning
  }
  return broker
}
