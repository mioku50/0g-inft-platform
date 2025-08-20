import 'dotenv/config'
import { ethers } from 'ethers'
import { create0GRateLimitedProvider } from '../server/rate-limited-provider'

let _createZGComputeNetworkBroker: any | null = null;

async function getCreateBrokerFn() {
  if (_createZGComputeNetworkBroker) return _createZGComputeNetworkBroker;

  const mod: any = await import('@0glabs/0g-serving-broker');
  _createZGComputeNetworkBroker =
    mod?.createZGComputeNetworkBroker ?? mod?.default?.createZGComputeNetworkBroker;

  if (!_createZGComputeNetworkBroker) {
    throw new Error('[broker] Failed to load createZGComputeNetworkBroker');
  }
  return _createZGComputeNetworkBroker;
}

export async function createBroker(walletOrSigner: any, addrs: { ledger: string; inference: string; fineTuning?: string }) {
  const createZGComputeNetworkBroker = await getCreateBrokerFn();
  return createZGComputeNetworkBroker(walletOrSigner, addrs);
}

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

  // Create broker using the new function
  brokerInstance = await createBroker(signer, {
    ledger: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT!,
    inference: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT!,
    fineTuning: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS!
  })
  
  console.log('broker created')
  return brokerInstance
}
