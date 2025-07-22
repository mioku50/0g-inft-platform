import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { tasksPlugin } from '../compute/broker-plugins/tasks'
import { inferencePlugin } from '../compute/broker-plugins/inference'

let broker: any

export async function getBroker() {
  if (broker) return broker

  if (process.env.MOCK_FINE_TUNE === '1') {
    broker = {}
    return broker
  }

  const rpc = process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpc) throw new Error('NEXT_PUBLIC_OG_RPC missing')
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  const provider = new ethers.JsonRpcProvider(rpc)
  const wallet = new ethers.Wallet(pk, provider)
  broker = (createZGComputeNetworkBroker as any)({
    rpcUrl: rpc,
    privateKey: pk,
    plugins: [tasksPlugin(), inferencePlugin()]
  })
  await broker.init()
  return broker
}
