import { Wallet, JsonRpcProvider, Contract } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { FINE_TUNING_SERVING_ABI } from '@/lib/contracts/abis'
import { fromWei } from '@/lib/constants'
import {
  RPC_URL,
  FINE_TUNING_SERVING,
  FINE_TUNE_PROVIDER,
  PK
} from '@/lib/server/compute-env'

let broker: any | null = null

export function getSignerAddress(b?: any) {
  const br = b || broker
  return br?.signerAddress || br?.signer?.address || null
}

export async function assertContractDeployed(provider: JsonRpcProvider, address: string) {
  const code = await provider.getCode(address)
  if (!code || code === '0x') {
    throw new Error(`Contract not deployed at ${address}`)
  }
}

export async function getBrokerOrThrow() {
  if (broker) return broker

  const provider = new JsonRpcProvider(RPC_URL)
  const signer = new Wallet(PK, provider)

  await assertContractDeployed(provider, FINE_TUNING_SERVING)

  try {
    broker = await createZGComputeNetworkBroker(signer)
  } catch (e: any) {
    throw new Error(`Failed to start 0G SDK: ${e.message}`)
  }

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
          refunds: acc.refunds || [],
          user: acc.user,
          provider: acc.provider,
          additionalInfo: acc.additionalInfo,
          providerSigner: acc.providerSigner
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
    },

    // Additional methods from the official ABI
    addDeliverable: async (user: string, modelRootHash: string) => {
      try {
        const tx = await contract.addDeliverable(user, modelRootHash)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getAllAccounts: async () => {
      try {
        return await contract.getAllAccounts()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getAllServices: async () => {
      try {
        return await contract.getAllServices()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getDeliverable: async (user: string, provider: string, index: bigint) => {
      try {
        return await contract.getDeliverable(user, provider, index)
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getPendingRefund: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
      try {
        const amount = await contract.getPendingRefund(user, provider)
        return {
          amountWei: amount.toString(),
          amount: fromWei(amount)
        }
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getService: async (provider: string = FINE_TUNE_PROVIDER) => {
      try {
        return await contract.getService(provider)
      } catch (e: any) {
        throw formatError(e)
      }
    },

    settleFees: async (verifierInput: any) => {
      try {
        const tx = await contract.settleFees(verifierInput)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
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

export { FINE_TUNE_PROVIDER }

export async function getBroker() {
  return getBrokerOrThrow()
}
