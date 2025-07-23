import { Wallet, JsonRpcProvider } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { tasksPlugin } from './broker-plugins/tasks'
import { inferencePlugin } from './broker-plugins/inference'

let broker: any

export async function getBroker() {
  if (broker) return broker

  const rpc = process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpc) throw new Error('NEXT_PUBLIC_OG_RPC missing')
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  const signer = new Wallet(pk, new JsonRpcProvider(rpc))
  broker = createZGComputeNetworkBroker({ signer })
  broker.use(tasksPlugin())
  broker.use(inferencePlugin())
  await broker.initialize()
  return broker
}
