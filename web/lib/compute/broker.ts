import { Wallet, Contract, JsonRpcProvider, Interface, ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { FINE_TUNING_SERVING_ABI } from '@/lib/contracts/abis'
import { fromWei } from '@/lib/constants'
import {
  getRpcUrl,
  getFineTuningServingAddress,
  getFineTuneProvider,
  getPrivateKey,
  getComputeLedgerContract,
  getComputeInferenceContract
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

function toWeiSafe(v?: any) {
  try {
    return ethers.toBigInt(v ?? 0)
  } catch {
    return 0n
  }
}

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

// Безопасные обёртки для работы с ledger
export const ledgerSafe = {
  get: async (brokerInstance?: any): Promise<{ balance: bigint; error?: string }> => {
    try {
      const br = brokerInstance || broker
      if (!br) {
        throw new Error('Broker not initialized')
      }
      
      const ledgerInfo = await br.ledger.getLedger()

      const balance = toWeiSafe(ledgerInfo.balance)
      
      console.log(`Ledger balance: ${fromWei(balance)} OG`)
      return { balance }
      
    } catch (error: any) {
      const msg = error.message || ''
      console.log('Ledger get error:', msg)
      if (msg.includes('LedgerNotExists')) {
        return { balance: 0n, error: 'LedgerNotExists' }
      }
      return { balance: 0n, error: msg }
    }
  },

  ensureMinBalance: async (minBalanceOG: number, brokerInstance?: any): Promise<boolean> => {
    try {
      const br = brokerInstance || broker
      if (!br) {
        console.log('Broker not available for balance check')
        return false
      }

      const { balance, error } = await ledgerSafe.get(br)
      if (error) {
        if (error === 'LedgerNotExists') {
          try {
            const initAmount = BigInt(Math.floor(Math.max(minBalanceOG, 0.05) * 1e18))
            await br.ledger.addLedger(initAmount)
            console.log(`Created ledger with ${fromWei(initAmount)} OG`)
            return true
          } catch (addErr: any) {
            console.log('Failed to create ledger:', addErr.message)
            return false
          }
        }
        console.log('Cannot check balance:', error)
        return false
      }

      const minBalanceWei = BigInt(Math.floor(minBalanceOG * 1e18))
      
      if (balance < minBalanceWei) {
        console.log(`Low balance (${fromWei(balance)} OG), adding funds...`)
        
        try {
          const addAmount = BigInt(Math.floor(Math.max(minBalanceOG * 2, 0.05) * 1e18))
          await br.ledger.addLedger(addAmount)
          console.log(`Added ${fromWei(addAmount)} OG to ledger`)
          return true
        } catch (addError: any) {
          console.log('Failed to add funds:', addError.message)
          return false
        }
      }
      
      console.log('Balance sufficient')
      return true
      
    } catch (error: any) {
      console.log('Balance check error (non-critical):', error.message)
      return false
    }
  }
}

export async function getBrokerOrThrow() {
  if (broker) return broker

  const rpcUrl = getRpcUrl()
  const servingAddr = getFineTuningServingAddress()
  const ledger = getComputeLedgerContract()
  const inference = getComputeInferenceContract()
  const pk = getPrivateKey()
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')

  const provider = create0GProvider()
  const signer = new Wallet(pk, provider)

  await assertContractDeployed(provider, servingAddr)

  try {
  broker = await createZGComputeNetworkBroker(
      signer,
      ledger,
      inference,
      servingAddr
    )
  } catch (e: any) {
    throw new Error(`Failed to start 0G SDK: ${e.message}`)
  }

  broker.signer = signer
  broker.signerAddress = signer.address
  
  // Добавляем безопасные методы к broker
  broker.ledgerSafe = ledgerSafe

  await addFineTuningSupport(broker, signer)

  // Attach minimal Ledger helper (used in /api/compute/account)
  if (!broker.ledger?.openFineTuningAccount) {
    const LEDGER_ABI = [
      'function openFineTuningAccount(address user, address provider) payable',
    ] as const
    const { ethers } = await import('ethers')
    const ledgerHelper = new ethers.Contract(
      getComputeLedgerContract(),
      LEDGER_ABI,
      signer
    )
    broker.ledger = {
      ...(broker.ledger || {}),
      openFineTuningAccount: (
        user: string,
        provider: string,
        overrides?: any
      ) => ledgerHelper.openFineTuningAccount(user, provider, overrides),
    }
  }

  return broker
}

async function addFineTuningSupport(broker: any, signer: Wallet) {
  const contract = new Contract(getFineTuningServingAddress(), FINE_TUNING_SERVING_ABI, signer)

  const servingAddress = getFineTuningServingAddress()
  const ledgerAddressEnv = process.env.COMPUTE_LEDGER_CONTRACT

  const servingAbi = FINE_TUNING_SERVING_ABI
  const serving = new Contract(servingAddress, servingAbi, signer)
  let ledgerAddress: string | null = ledgerAddressEnv || null
  if (!ledgerAddress) {
    try {
      ledgerAddress = await (serving as any).ledgerAddress()
    } catch {
      ledgerAddress = null
    }
  }

  let ledger: Contract | null = null
  const LEDGER_ABI = [
    'function addAccount(address user, address provider, string info) payable',
    'function depositFund(address user, address provider, uint256 cancel) payable'
  ] as const
  if (ledgerAddress) {
    ledger = new Contract(ledgerAddress, LEDGER_ABI, signer)
  }

  broker.fineTuning = {
    accountExists: async (user: string, provider: string = getFineTuneProvider()) => {
      try {
        return await contract.accountExists(user, provider)
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getAccount: async (user: string, provider: string = getFineTuneProvider()) => {
      try {
        const acc = await contract.getAccount(user, provider)
        const balance = toWeiSafe(acc.balance)
        const pending = toWeiSafe(acc.pendingRefund)
        return {
          balanceWei: balance.toString(),
          balance: fromWei(balance),
          pendingRefundWei: pending.toString(),
          pendingRefund: fromWei(pending),
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
      provider: string = getFineTuneProvider(),
      info: string = 'INFT Platform User',
      opts: any = {}
    ) => {
      if (!ledger) {
        throw new Error('Ledger contract is not configured. Set COMPUTE_LEDGER_CONTRACT or ensure serving.ledgerAddress() is available.')
      }
      try {
        const tx = await (ledger as any).addAccount(user, provider, info, opts)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    depositFund: async (
      user: string,
      provider: string = getFineTuneProvider(),
      cancel: bigint = 0n,
      opts: any = {}
    ) => {
      if (!ledger) {
        throw new Error('Ledger contract is not configured. Set COMPUTE_LEDGER_CONTRACT or ensure serving.ledgerAddress() is available.')
      }
      try {
        const tx = await (ledger as any).depositFund(user, provider, cancel, opts)
        await tx.wait()
        return tx
      } catch (e: any) {
        throw formatError(e)
      }
    },

    acknowledgeProviderSigner: async (
      provider: string = getFineTuneProvider(),
      signerAddr: string = getFineTuneProvider()
    ) => {
      try {
        const tx = await contract.acknowledgeProviderSigner(provider, signerAddr)
        const rc = await tx.wait()
        return rc ? tx : null
      } catch (e: any) {
        const msg = String(e?.message || e)
        if (/already|acknowledged|known/i.test(msg)) return null
        throw formatError(e)
      }
    },

    acknowledgeDeliverable: async (
      provider: string = getFineTuneProvider(),
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

    requestRefundAll: async (user: string, provider: string = getFineTuneProvider()) => {
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

    getPendingRefund: async (user: string, provider: string = getFineTuneProvider()) => {
      try {
        const amount = toWeiSafe(await contract.getPendingRefund(user, provider))
        return {
          amountWei: amount.toString(),
          amount: fromWei(amount)
        }
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getService: async (provider: string = getFineTuneProvider()) => {
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
  // Фильтруем invalid BigNumberish из сообщений об ошибках
  let message = e.message
  if (message && message.includes('invalid BigNumberish')) {
    message = message.replace(/invalid BigNumberish value[^,]*/g, 'BigInt conversion error')
  }
  
  return new Error(
    JSON.stringify({
      message,
      code: e.code,
      reason: e.reason,
      shortMessage: e.shortMessage,
      data: e.data,
      tx: e.transaction?.hash
    })
  )
}

export { getFineTuneProvider }

export async function getBroker() {
  return getBrokerOrThrow()
}
