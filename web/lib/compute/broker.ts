import { Wallet, JsonRpcProvider, ethers, Interface, Contract } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { fromWei } from '@/lib/constants'
import {
  getRpcUrl,
  getFineTuneProvider,
  getPrivateKey,
  getComputeLedgerContract,
  getComputeInferenceContract,
  logEnvironmentStatus
} from '@/lib/server/compute-env'
import { create0GProvider } from '@/lib/server/provider'

export const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
  'function acknowledgeProviderSigner(address provider, address providerSigner)',
  'function acknowledgeDeliverable(address provider, uint256 index)',
  'function addAccount(address user, address provider, string additionalInfo) payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable',
  'function requestRefundAll(address user, address provider)'
] as const

export const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external'
] as const

const ERROR_ABI = [
  'error AccountExists(address user,address provider)',
  'error AccountNotExists(address user,address provider)',
  'error ServiceNotExist(address provider)',
  'error RefundLocked(address user,address provider,uint256 index)',
  'error RefundProcessed(address user,address provider,uint256 index)'
]
const ERR_IFACE = new Interface(ERROR_ABI)

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

async function ensureProviderRegistered(providerAddr: string, serving: ethers.Contract) {
  const svc = await serving.getService(providerAddr)
  if (!svc || !svc.url || svc.url.length === 0) {
    throw new Error(`ServiceNotExist(provider=${providerAddr})`)
  }
  return svc
}

const LEDGER_IFACE = new Interface(LEDGER_ABI)
const SERVING_IFACE = new Interface([
  ...SERVING_ABI,
  'error AccountExists(address user,address provider)',
  'error ServiceNotExist(address provider)'
])

export function decodeRevert(err: any): string | null {
  const data = err?.info?.error?.data || err?.data
  if (!data) return null
  try {
    const p: any = ERR_IFACE.parseError(data)
    return p ? `${p.name}(${p.args?.map(String).join(',')})` : null
  } catch {
    return null
  }
}

const inFlight = new Map<string, Promise<any>>()
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key)! as Promise<T>
  const p = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, p)
  return p
}

function formatError(e: any): Error {
  try {
    const data = e?.info?.error?.data || e?.data
    if (data) {
      for (const iface of [SERVING_IFACE, LEDGER_IFACE]) {
        try {
          const parsed = iface.parseError(data)
          if (parsed) {
            const errorName = parsed.name
            const errorArgs = parsed.args?.map(String).join(',') || ''
            console.log('[fine] formatError:parsed', { errorName, errorArgs, data })
            return new Error(`${errorName}(${errorArgs})`)
          }
        } catch {}
      }
    }

    const msg = e?.shortMessage || e?.reason || e?.message || String(e)
    
    // Enhanced error categorization for FineTuningServing
    if (/AccountExists/i.test(msg)) {
      return new Error('AccountExists')
    }
    if (/AccountNotExists/i.test(msg)) {
      return new Error('AccountNotExists')
    }
    if (/ServiceNotExist/i.test(msg)) {
      return new Error('ServiceNotExist')
    }
    if (/caller is not the ledger contract/i.test(msg)) {
      return new Error(
        'Operations must be called through Ledger contract, not directly on FineTuningServing'
      )
    }
    if (/reverted.*no data/i.test(msg) || msg === 'require(false)' || msg.includes('require(false)')) {
      return new Error('Transaction reverted without reason (check params, provider registration, msg.value)')
    }
    if (/insufficient funds/i.test(msg)) {
      return new Error('InsufficientBalance')
    }
    if (/execution reverted/i.test(msg)) {
      return new Error('Contract execution failed - likely require(false) or validation error')
    }
    
    console.log('[fine] formatError:unhandled', { msg, type: typeof e, keys: Object.keys(e) })
    return new Error(msg)
  } catch {
    return new Error('Unknown EVM error')
  }
}

function parseSimulationError(e: any): Error {
  const decoded = decodeRevert(e)
  const msg = decoded || e?.shortMessage || e?.reason || e?.message || ''
  if (/AccountExists/i.test(msg)) return new Error('AccountExists')
  if (/ServiceNotExist|ProviderNotExist/i.test(msg)) return new Error('ProviderNotExist')
  if (/insufficient funds/i.test(msg)) return new Error('InsufficientBalance')
  return new Error(`reverted: ${msg}`)
}

function generateDiagnostics(method: string, params: any[], value?: bigint, error?: any) {
  const paramsDigest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(params))).slice(0, 10)
  const rpcUrl = getRpcUrl()
  const chainId = rpcUrl.includes('galileo') ? 'galileo-testnet' : 'unknown'
  
  return {
    method,
    paramsDigest,
    msgValue: value?.toString() || '0',
    chainId,
    timestamp: new Date().toISOString(),
    contracts: {
      serving: SERVING_ADDR,
      ledger: LEDGER_ADDR
    },
    error: error ? {
      message: error.message,
      type: error.constructor.name,
      code: error.code
    } : undefined
  }
}

function formatTxUrl(hash: string): string | null {
  const rpcUrl = getRpcUrl()
  if (rpcUrl.includes('galileo')) {
    return `https://chainscan-galileo.0g.ai/tx/${hash}`
  }
  return `https://explorer.0g.ai/tx/${hash}`
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

export async function addAccountWithDeposit(
  signer: ethers.Signer,
  ledger: Contract,
  user: string,
  provider: string,
  amount: string,
  extraInfo = 'INFT Platform User'
) {
  const key = `${user}:${provider}:addAccount`
  const value = ethers.parseEther(amount)

  return withLock(key, async () => {
    try {
      console.log('[fine] addAccount:start', { user, provider, value: value.toString() })
      
      // Use Ledger contract for account operations (it will call FineTuningServing internally)
      const ledgerContract = getLedgerContract(signer)
      console.log('[fine] Using Ledger contract for addAccount:', ledgerContract.target || ledgerContract.address)
      
      // Get Serving contract for validation checks
      const servingContract = getServingContract(signer)
      
      // Pre-validation: check if provider is registered
      try {
        const service = await servingContract.getService(provider)
        if (!service || !service.url || service.url.length === 0) {
          throw new Error(`ServiceNotExist(provider=${provider})`)
        }
        console.log('[fine] addAccount:provider-validation:ok', { 
          provider, 
          url: service.url, 
          occupied: service.occupied,
          models: service.models?.length || 0
        })
      } catch (validationErr: any) {
        console.log('[fine] addAccount:provider-validation:error', validationErr.message)
        if (validationErr.message.includes('ServiceNotExist')) {
          throw new Error('ProviderNotExist')
        }
        throw validationErr
      }

      // Pre-validation: check if account already exists
      try {
        const accountExists = await servingContract.accountExists(user, provider)
        if (accountExists) {
          console.log('[fine] addAccount:account-exists', { user, provider })
          throw new Error('AccountExists')
        }
      } catch (existsErr: any) {
        if (existsErr.message.includes('AccountExists')) {
          throw existsErr
        }
        // Ignore other errors as account might not exist yet
      }

      try {
        // Simulate transaction on Ledger contract
        const gasEstimate = await signer.estimateGas({
          to: ledgerContract.target || ledgerContract.address,
          data: ledgerContract.interface.encodeFunctionData('addAccount', [user, provider, extraInfo]),
          value: value
        })
        console.log('[fine] addAccount:simulate:ok', gasEstimate.toString())
      } catch (simErr: any) {
        console.log('[fine] addAccount:simulate:error', simErr.message)
        throw parseSimulationError(simErr)
      }

      // Execute transaction on Ledger contract
      const tx = await ledgerContract.addAccount(user, provider, extraInfo, { value })
      console.log('[fine] addAccount:sent', tx.hash)
      const txUrl = formatTxUrl(tx.hash)

      signer.provider!
        .waitForTransaction(tx.hash, 1, 60000)
        .then((rc) => {
          if (rc)
            console.log('[fine] addAccount:mined', tx.hash, `${rc.status}/${rc.confirmations}`)
          else
            console.log('[fine] addAccount:mined:timeout')
        })
        .catch(() => console.log('[fine] addAccount:mined:timeout'))

      return { txHash: tx.hash, txUrl, status: 'submitted' }
    } catch (e: any) {
      console.log('[fine] addAccount:error', e.message, e.stack)
      throw formatError(e)
    }
  })
}

export async function deposit(
  signer: ethers.Signer,
  ledger: Contract,
  user: string,
  provider: string,
  amount: string
) {
  const key = `${user}:${provider}:deposit`
  const value = ethers.parseEther(amount)

  return withLock(key, async () => {
    try {
      console.log('[fine] deposit:start', { user, provider, value: value.toString() })
      
      // Use Ledger contract for deposit operations (it will call FineTuningServing internally)
      const ledgerContract = getLedgerContract(signer)
      console.log('[fine] Using Ledger contract for depositFund:', ledgerContract.target || ledgerContract.address)
      
      // Get Serving contract for validation checks
      const servingContract = getServingContract(signer)
      
      // Pre-validation: check if provider is registered
      try {
        const service = await servingContract.getService(provider)
        if (!service || !service.url || service.url.length === 0) {
          throw new Error(`ServiceNotExist(provider=${provider})`)
        }
        console.log('[fine] deposit:provider-validation:ok', { 
          provider, 
          url: service.url, 
          occupied: service.occupied 
        })
      } catch (validationErr: any) {
        console.log('[fine] deposit:provider-validation:error', validationErr.message)
        if (validationErr.message.includes('ServiceNotExist')) {
          throw new Error('ProviderNotExist')
        }
        throw validationErr
      }

      // Pre-validation: check if account exists
      try {
        const accountExists = await servingContract.accountExists(user, provider)
        if (!accountExists) {
          console.log('[fine] deposit:account-not-exists', { user, provider })
          throw new Error('AccountNotExists')
        }
      } catch (existsErr: any) {
        if (existsErr.message.includes('AccountNotExists')) {
          throw existsErr
        }
        throw existsErr
      }
      
      try {
        // Simulate transaction on Ledger contract
        const gasEstimate = await signer.estimateGas({
          to: ledgerContract.target || ledgerContract.address,
          data: ledgerContract.interface.encodeFunctionData('depositFund', [user, provider, 0]),
          value: value
        })
        console.log('[fine] deposit:simulate:ok', gasEstimate.toString())
      } catch (simErr: any) {
        console.log('[fine] deposit:simulate:error', simErr.message)
        throw parseSimulationError(simErr)
      }

      // Execute transaction on Ledger contract
      const tx = await ledgerContract.depositFund(user, provider, 0, { value })
      console.log('[fine] deposit:sent', tx.hash)
      const txUrl = formatTxUrl(tx.hash)

      signer.provider!
        .waitForTransaction(tx.hash, 1, 60000)
        .then((rc) => {
          if (rc)
            console.log('[fine] deposit:mined', tx.hash, `${rc.status}/${rc.confirmations}`)
          else
            console.log('[fine] deposit:mined:timeout')
        })
        .catch(() => console.log('[fine] deposit:mined:timeout'))

      return { txHash: tx.hash, txUrl, status: 'submitted' }
    } catch (e: any) {
      console.log('[fine] deposit:error', e.message, e.stack)
      throw formatError(e)
    }
  })
}

export async function getBrokerOrThrow() {
  if (broker) return broker

  // Log environment status on first initialization
  logEnvironmentStatus()

  const rpcUrl = getRpcUrl()
  const servingAddr = SERVING_ADDR
  const ledger = getComputeLedgerContract()
  const inference = getComputeInferenceContract()
  const pk = getPrivateKey()
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')

  const provider = create0GProvider()
  const signer = new Wallet(pk, provider)

  // Verify contracts are deployed
  await assertContractDeployed(provider, servingAddr)
  await assertContractDeployed(provider, ledger)
  await assertContractDeployed(provider, inference)

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

  // Ensure ledger contract is properly attached
  if (!broker.ledger || typeof broker.ledger.addAccount !== 'function') {
    console.log('[fine] Adding manual ledger contract methods')
    const ledgerContract = getLedgerContract(signer)
    broker.ledger = {
      ...(broker.ledger || {}),
      addAccount: ledgerContract.addAccount.bind(ledgerContract),
      depositFund: ledgerContract.depositFund.bind(ledgerContract),
      requestRefundAll: ledgerContract.requestRefundAll.bind(ledgerContract)
    }
  }

  console.log('[fine] Broker initialized successfully', {
    signerAddress: broker.signerAddress,
    servingAddress: servingAddr,
    ledgerAddress: ledger
  })

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
      amountEth: string
    ) => {
      try {
        await ensureProviderRegistered(provider, serving)
        const value = ethers.parseEther(amountEth)
        console.log('[fine] addAccount:start', { user, provider, value: value.toString() })
        
        // Pre-validation: check if account already exists
        try {
          const accountExists = await serving.accountExists(user, provider)
          if (accountExists) {
            console.log('[fine] addAccount:account-exists', { user, provider })
            throw new Error('AccountExists')
          }
        } catch (existsErr: any) {
          if (existsErr.message.includes('AccountExists')) {
            throw existsErr
          }
          // Ignore other errors as account might not exist yet
        }
        
        try {
          const gas = await serving.estimateGas.addAccount(user, provider, info, { value })
          console.log('[fine] addAccount:simulate:ok', gas.toString())
        } catch (simErr: any) {
          throw parseSimulationError(simErr)
        }

        const tx = await serving.addAccount(user, provider, info, { value })
        console.log('[fine] addAccount:sent', tx.hash)
        const txUrl = formatTxUrl(tx.hash)
        const diagnostics = generateDiagnostics('addAccount', [user, provider, info], value)
        console.log('[fine] addAccount:diagnostics', diagnostics)

        signer.provider!
          .waitForTransaction(tx.hash, 1, 60000)
          .then((rc) => {
            if (rc)
              console.log('[fine] addAccount:mined', tx.hash, `${rc.status}/${rc.confirmations}`)
            else
              console.log('[fine] addAccount:mined:timeout')
          })
          .catch(() => console.log('[fine] addAccount:mined:timeout'))

        return { txHash: tx.hash, txUrl, status: 'submitted' }
      } catch (e: any) {
        throw formatError(e)
      }
    },

    depositFund: async (
      user: string,
      provider: string,
      cancel: bigint,
      amountEth: string
    ) => {
      try {
        await ensureProviderRegistered(provider, serving)
        const value = ethers.parseEther(amountEth)
        console.log('[fine] depositFund:start', { user, provider, value: value.toString() })
        
        // Pre-validation: check if account exists
        try {
          const accountExists = await serving.accountExists(user, provider)
          if (!accountExists) {
            console.log('[fine] depositFund:account-not-exists', { user, provider })
            throw new Error('AccountNotExists')
          }
        } catch (existsErr: any) {
          if (existsErr.message.includes('AccountNotExists')) {
            throw existsErr
          }
          throw existsErr
        }
        
        try {
          const gas = await serving.estimateGas.depositFund(user, provider, cancel, { value })
          console.log('[fine] depositFund:simulate:ok', gas.toString())
        } catch (simErr: any) {
          throw parseSimulationError(simErr)
        }
        
        const tx = await serving.depositFund(user, provider, cancel, { value })
        console.log('[fine] depositFund:sent', tx.hash)
        const txUrl = formatTxUrl(tx.hash)

        signer.provider!
          .waitForTransaction(tx.hash, 1, 60000)
          .then((rc) => {
            if (rc)
              console.log('[fine] depositFund:mined', tx.hash, `${rc.status}/${rc.confirmations}`)
            else
              console.log('[fine] depositFund:mined:timeout')
          })
          .catch(() => console.log('[fine] depositFund:mined:timeout'))

        return { txHash: tx.hash, txUrl, status: 'submitted' }
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
        const tx = await serving.requestRefundAll(user, provider)
        console.log('[fine] requestRefundAll:sent', tx.hash)
        const txUrl = formatTxUrl(tx.hash)

        signer.provider!
          .waitForTransaction(tx.hash, 1, 60000)
          .then((rc) => {
            if (rc)
              console.log('[fine] requestRefundAll:mined', tx.hash, `${rc.status}/${rc.confirmations}`)
            else
              console.log('[fine] requestRefundAll:mined:timeout')
          })
          .catch(() => console.log('[fine] requestRefundAll:mined:timeout'))

        return { txHash: tx.hash, txUrl, status: 'submitted' }
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
