import { Wallet, JsonRpcProvider, Contract } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { FINE_TUNING_SERVING_ABI } from '@/lib/contracts/abis'
import { RPC_URL, FINE_TUNING_SERVING, FINE_TUNE_PROVIDER, PK, fromWei } from '@/lib/constants'

let broker: any

export function getSignerAddress(b?: any) {
  const br = b || broker
  if (!br) return null
  return br.signerAddress || br.signer?.address || null
}


export async function getBroker() {
  if (broker) return broker

  if (process.env.MOCK_FINE_TUNE === '1') {
    broker = createMockBroker()
    return broker
  }

  const provider = new JsonRpcProvider(RPC_URL)
  const signer = new Wallet(PK, provider)

  const code = await provider.getCode(FINE_TUNING_SERVING)
  const deployed = code && code !== '0x'
  if (!deployed) {
    console.warn(`FineTuningServing not deployed at ${FINE_TUNING_SERVING}, using mock broker`)
    broker = createMockBroker()
    return broker
  }

  broker = await createZGComputeNetworkBroker(signer)
  broker.signer = signer
  broker.signerAddress = signer.address
  await addFineTuningSupport(broker, signer)
  return broker
}

async function addFineTuningSupport(broker: any, signer: Wallet) {
  const contract = new Contract(FINE_TUNING_SERVING, FINE_TUNING_SERVING_ABI, signer)

  broker.fineTuning = {
    accountExists: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
      try {
        return await contract.accountExists(user, provider)
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getAccount: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
      try {
        const acc = await contract.getAccount(user, provider)
        return {
          balanceWei: acc.balance.toString(),
          balance: fromWei(acc.balance),
          pendingRefundWei: acc.pendingRefund.toString(),
          pendingRefund: fromWei(acc.pendingRefund),
          deliverables: acc.deliverables || [],
          nonce: acc.nonce ? BigInt(acc.nonce) : 0n,
          refunds: acc.refunds || []
        }
      } catch (e: any) {
        throw formatError(e)
      }
    },

    addAccount: async (
      user: string,
      provider: string = FINE_TUNE_PROVIDER,
      info: string = 'INFT Platform User',
      opts: any = {}
    ) => {
      try {
        const tx = await contract.addAccount(user, provider, info, opts)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    depositFund: async (
      user: string,
      provider: string = FINE_TUNE_PROVIDER,
      cancel: bigint = 0n,
      opts: any = {}
    ) => {
      try {
        const tx = await contract.depositFund(user, provider, cancel, opts)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    acknowledgeProviderSigner: async (
      provider: string = FINE_TUNE_PROVIDER,
      signerAddr: string = FINE_TUNE_PROVIDER
    ) => {
      try {
        const tx = await contract.acknowledgeProviderSigner(provider, signerAddr)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    acknowledgeDeliverable: async (
      provider: string = FINE_TUNE_PROVIDER,
      index: bigint = 0n
    ) => {
      try {
        const tx = await contract.acknowledgeDeliverable(provider, index)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    requestRefundAll: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
      try {
        const tx = await contract.requestRefundAll(user, provider)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    }
  }
}

function createMockBroker() {
  return {
    signer: { address: '0x0000000000000000000000000000000000000000' },
    signerAddress: '0x0000000000000000000000000000000000000000',
    inference: {
      getServiceMetadata: async () => ({ endpoint: 'http://localhost:3080', model: 'mock' }),
      getRequestHeaders: async () => ({}),
      acknowledgeProviderSigner: async () => {}
    },
    fineTuning: {
      accountExists: async () => true,
      getAccount: async () => ({ balance: 0n, pendingRefund: 0n, deliverables: [] }),
      addAccount: async () => {},
      depositFund: async () => {},
      acknowledgeProviderSigner: async () => {},
      acknowledgeDeliverable: async () => {},
      requestRefundAll: async () => {}
    }
  }
}

function formatError(e: any) {
  return new Error(
    JSON.stringify({
      message: e.message,
      code: e.code,
      reason: e.reason,
      shortMessage: e.shortMessage,
      data: e.data,
      tx: e.transaction?.hash
    })
  )
}

export { broker, FINE_TUNE_PROVIDER }
