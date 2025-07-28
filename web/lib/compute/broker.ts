import { Wallet, JsonRpcProvider, ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { fromWei } from '@/lib/constants'
import {
  getRpcUrl,
  getFineTuneProvider,
  getPrivateKey,
  getComputeLedgerContract,
  getComputeInferenceContract
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

export const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function acknowledgeProviderSigner(address provider, address providerSigner)',
  'function acknowledgeDeliverable(address provider, uint256 index)'
]

export const LEDGER_ABI = [
  'function addAccount(address user, address provider, string additionalInfo) payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable',
  'function requestRefundAll(address user, address provider)'
]

const SERVING_ADDR = (
  process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS ??
  process.env.FINE_TUNING_SERVING_ADDRESS
) as string

const LEDGER_ADDR = getComputeLedgerContract()

if (!SERVING_ADDR) {
  throw new Error('Fine-tuning: Serving address is missing')
}
if (!LEDGER_ADDR) {
  throw new Error('Fine-tuning: Ledger address is missing')
}

export function getServingContract(
  signerOrProvider: ethers.Signer | ethers.Provider
) {
  console.log('[fine] Using Serving address:', SERVING_ADDR)
  return new ethers.Contract(SERVING_ADDR, SERVING_ABI, signerOrProvider)
}

export function getLedgerContract(
  signerOrProvider: ethers.Signer | ethers.Provider
) {
  console.log('[fine] Using Ledger address:', LEDGER_ADDR)
  return new ethers.Contract(LEDGER_ADDR, LEDGER_ABI, signerOrProvider)
}

function formatError(e: any): Error {
  // CHANGED: читаем reason, shortMessage, пустые reverts
  try {
    const msg = e?.shortMessage || e?.reason || e?.message || String(e)
    if (/caller is not the ledger contract/i.test(msg)) {
      return new Error(
        'Wrong contract: call Ledger, not Serving (вызывайте методы аккаунта через Ledger‑контракт)'
      )
    }
    if (/reverted.*no data/i.test(msg) || msg === 'require(false)' || msg.includes('require(false)')) {
      return new Error('Transaction reverted without reason (check params, provider, msg.value)')
    }
    return new Error(msg)
  } catch {
    return new Error('Unknown EVM error')
  }
}

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
  const servingAddr = SERVING_ADDR
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
  const serving = getServingContract(signer)
  const ledger = getLedgerContract(signer)

  broker.fineTuning = {
    accountExists: async (user: string, provider: string) => {
      try {
        return await serving.accountExists(user, provider)
      } catch (e: any) {
        throw formatError(e)
      }
    },

    getAccount: async (user: string, provider: string) => {
      try {
        const acc: any = await serving.getAccount(user, provider)
        return {
          ...acc,
          balance: acc.balance?.toString?.() ?? '0',
          pendingRefund: acc.pendingRefund?.toString?.() ?? '0'
        }
      } catch (e: any) {
        throw formatError(e)
      }
    },

    addAccount: async (
      user: string,
      provider: string,
      info: string,
      opts: any = {}
    ) => {
      try {
        const tx = await ledger.addAccount(user, provider, info, opts)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    depositFund: async (
      user: string,
      provider: string,
      cancel: bigint,
      opts: any = {}
    ) => {
      try {
        const tx = await ledger.depositFund(user, provider, cancel, opts)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    acknowledgeProviderSigner: async (provider: string, providerSigner: string = provider) => {
      try {
        const tx = await serving.acknowledgeProviderSigner(provider, providerSigner)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    acknowledgeDeliverable: async (provider: string, index: bigint) => {
      try {
        const tx = await serving.acknowledgeDeliverable(provider, index)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e)
      }
    },

    requestRefundAll: async (user: string, provider: string) => {
      try {
        const tx = await ledger.requestRefundAll(user, provider)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e)
      }
    }
  }
}


export { getFineTuneProvider }

export async function getBroker() {
  return getBrokerOrThrow()
}
