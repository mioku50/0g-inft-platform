import { Wallet, JsonRpcProvider, ethers, Interface, Contract } from 'ethers'
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker')
import { fromWei } from '@/lib/constants'
import {
  getRpcUrl,
  getFineTuneProvider,
  getPrivateKey,
  getComputeLedgerContract,
  getComputeInferenceContract,
  logEnvironmentStatus
} from '@/lib/server/compute-env'
import { getRateLimitedProvider, createRateLimitedWallet } from '@/lib/server/rate-limited-provider'

// Global broker singleton with rate limiting
let globalBroker: any | null = null
let brokerInitTime: number = 0
const BROKER_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

// Provider acknowledgment cache - persistent across requests
const providerAckCache = new Map<string, { acknowledged: boolean; timestamp: number }>()
const PROVIDER_ACK_TTL = 30 * 60 * 1000 // 30 minutes cache

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
  // Account management - SDK compatible methods
  'function addLedger() external',
  'function depositFund() external payable',
  'function getLedger(address user) external view returns (tuple(address user, uint256 amount, uint256 lastUpdated))',
  
  // Legacy methods for backward compatibility
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external',
  
  // Account queries
  'function accountExists(address user, address provider) external view returns (bool)',
  'function getAccount(address user, address provider) external view returns (tuple(address user, address provider, uint256 nonce, uint256 balance, uint256 pendingRefund, tuple(uint256 index, uint256 amount, uint256 createdAt, bool processed)[] refunds, string additionalInfo, address providerSigner, tuple(bytes modelRootHash, bytes encryptedSecret, bool acknowledged)[] deliverables))',
  
  // Service management
  'function getService(address provider) external view returns (tuple(address provider, string url, tuple(uint256, uint256, uint256, uint256, string) quota, uint256 pricePerToken, address providerSigner, bool occupied, string[] models))',
  
  // Provider signer management
  'function acknowledgeProviderSigner(address provider, address providerSigner) external',
  
  // Fine-tuning specific methods
  'function createTask(address provider, string memory model, bytes32 datasetHash, string memory trainingParams, uint256 fee) external returns (bytes32)',
  'function getTask(address provider, bytes32 taskId) external view returns (tuple(bytes32 id, address user, address provider, string model, bytes32 datasetHash, string trainingParams, uint256 fee, uint8 status, uint256 createdAt))',
  'function acknowledgeDeliverable(address provider, uint256 deliverableIndex) external',
  
  // Events
  'event AccountCreated(address indexed user, address indexed provider, uint256 balance)',
  'event FundsDeposited(address indexed user, address indexed provider, uint256 amount)',
  'event TaskCreated(address indexed user, address indexed provider, bytes32 indexed taskId, string model)',
  'event DeliverableAcknowledged(address indexed user, address indexed provider, uint256 deliverableIndex)'
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

function formatError(e: any, depth = 0): Error {
  // Prevent infinite recursion by limiting depth
  if (depth > 3) {
    return new Error('Error formatting failed - too many nested errors')
  }

  try {
    const data = e?.info?.error?.data || e?.data
    if (data) {
      for (const iface of [SERVING_IFACE, LEDGER_IFACE]) {
        try {
          const parsed = iface.parseError(data)
          if (parsed) {
            const errorName = parsed.name
            const errorArgs = parsed.args?.map(String).join(',') || ''
            console.log('[fine] formatError:parsed', { errorName, errorArgs, data, depth })
            return new Error(`${errorName}(${errorArgs})`)
          }
        } catch (parseErr) {
          // Avoid recursive formatError calls
          console.log('[fine] formatError:parse-failed', { depth, parseErr: String(parseErr) })
        }
      }
    }

    const msg = e?.shortMessage || e?.reason || e?.message || String(e)
    
    // Enhanced error categorization for FineTuningServing and SDK
    if (/AccountExists/i.test(msg)) {
      return new Error('AccountExists')
    }
    if (/AccountNotExists/i.test(msg)) {
      return new Error('AccountNotExists')
    }
    if (/ServiceNotExist/i.test(msg)) {
      return new Error('ServiceNotExist')
    }
    if (/Ledger already exists/i.test(msg)) {
      // Extract balance from the error message if possible
      const balanceMatch = msg.match(/balance:\s*([\d.]+)\s*A0GI/)
      const balance = balanceMatch ? balanceMatch[1] : 'unknown'
      return new Error(`Ledger already exists with balance: ${balance} A0GI`)
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
    
    console.log('[fine] formatError:unhandled', { msg, type: typeof e, keys: Object.keys(e), depth })
    return new Error(msg)
  } catch (formatErr) {
    // Prevent recursive formatError calls - return simple error instead
    console.log('[fine] formatError:catch', { depth, formatErr: String(formatErr) })
    return new Error(`Error formatting failed at depth ${depth}: ${String(e)}`)
  }
}

function parseSimulationError(e: any): Error {
  try {
    const decoded = decodeRevert(e)
    const msg = decoded || e?.shortMessage || e?.reason || e?.message || String(e)
    if (/AccountExists/i.test(msg)) return new Error('AccountExists')
    if (/ServiceNotExist|ProviderNotExist/i.test(msg)) return new Error('ProviderNotExist')
    if (/insufficient funds/i.test(msg)) return new Error('InsufficientBalance')
    return new Error(`reverted: ${msg}`)
  } catch (parseErr) {
    return new Error(`Simulation error parsing failed: ${String(e)}`)
  }
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

/**
 * Check if provider is already acknowledged (with caching)
 */
async function isProviderAcknowledged(providerAddress: string): Promise<boolean> {
  const cached = providerAckCache.get(providerAddress)
  const now = Date.now()
  
  if (cached && (now - cached.timestamp) < PROVIDER_ACK_TTL) {
    console.log(`[Broker] Provider ${providerAddress} acknowledgment cached: ${cached.acknowledged}`)
    return cached.acknowledged
  }
  
  // Cache miss - we'll acknowledge lazily when needed
  return false
}

/**
 * Mark provider as acknowledged in cache
 */
function markProviderAcknowledged(providerAddress: string) {
  providerAckCache.set(providerAddress, {
    acknowledged: true,
    timestamp: Date.now()
  })
  console.log(`[Broker] Cached provider acknowledgment for ${providerAddress}`)
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
        console.log(`Low balance (${fromWei(balance)} OG), but account already exists`)
        console.log('Balance check complete - not attempting auto-deposit for existing accounts')
        // DON'T auto-deposit - user should explicitly add funds
        return false
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
      
      // Get broker instance to use SDK methods
      const broker = await getBroker()
      if (!broker || !broker.fineTuning) {
        throw new Error('Broker not available or fineTuning module missing')
      }
      
      // Pre-validation: check if provider is registered
      const servingContract = getServingContract(signer)
      let service: any
      try {
        service = await servingContract.getService(provider)
        if (!service || !service.url || service.url.length === 0) {
          throw new Error(`ServiceNotExist(provider=${provider})`)
        }
        console.log('[fine] addAccount:provider-validation:ok', { 
          provider, 
          url: service.url, 
          occupied: service.occupied,
          models: service.models?.length || 0,
          providerSigner: service.providerSigner
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

      // Verify Ledger contract is properly configured
      const ledgerAddress = getComputeLedgerContract()
      console.log('[fine] addAccount:using-ledger', ledgerAddress)
      
      // The official Ledger address 0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa is correct
      // according to CLI documentation and successful CLI tests

      // Use SDK broker to handle the complex flow
      try {
        console.log('[fine] addAccount:using-sdk-broker', {
          user,
          provider,
          extraInfo,
          valueInOG: ethers.formatEther(value)
        })
        
        // The SDK broker handles all the complexity internally
        // It will route the call to the appropriate contract (Ledger or FineTuningServing)
        const tx = await broker.fineTuning.addAccount(
          user,
          provider,
          extraInfo,
          { value }
        )
        
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
      } catch (sdkErr: any) {
        console.log('[fine] addAccount:sdk-error', sdkErr.message)
        
        // If SDK also fails, try our fallback approach with acknowledgeProviderSigner first
        if (service.providerSigner && service.providerSigner !== ethers.ZeroAddress) {
          try {
            console.log('[fine] addAccount:trying-acknowledge-first')
            
            // Acknowledge provider signer first
            const ackTx = await servingContract.acknowledgeProviderSigner(provider, service.providerSigner)
            console.log('[fine] addAccount:acknowledge-sent', ackTx.hash)
            await ackTx.wait()
            
            // Try SDK again after acknowledgment
            const tx = await broker.fineTuning.addAccount(
              user,
              provider,
              extraInfo,
              { value }
            )
            
            console.log('[fine] addAccount:retry-sent', tx.hash)
            const txUrl = formatTxUrl(tx.hash)

            signer.provider!
              .waitForTransaction(tx.hash, 1, 60000)
              .then((rc) => {
                if (rc)
                  console.log('[fine] addAccount:retry-mined', tx.hash, `${rc.status}/${rc.confirmations}`)
              })
              .catch(() => console.log('[fine] addAccount:retry-mined:timeout'))

            return { txHash: tx.hash, txUrl, status: 'submitted' }
          } catch (retryErr: any) {
            console.log('[fine] addAccount:retry-error', retryErr.message)
            throw parseSimulationError(retryErr)
          }
        }
        
        throw parseSimulationError(sdkErr)
      }
    } catch (e: any) {
      console.log('[fine] addAccount:error', e.message, e.stack)
      throw formatError(e, 0)
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
      
      // Use SDK broker for deposit operations
      console.log('[fine] deposit:using-sdk-broker', {
        user,
        provider,
        valueInOG: ethers.formatEther(value)
      })
      
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
      
      // Use direct contract call instead of SDK broker due to compatibility issues
      const ledgerContract = new ethers.Contract(ledger, LEDGER_ABI, signer)
      
      const tx = await ledgerContract.depositFund(
        user,
        provider,
        0n, // cancelRetrievingAmount
        { value }
      )
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
      throw formatError(e, 0)
    }
  })
}

export async function getBrokerOrThrow() {
  const now = Date.now()
  
  // Use cached global broker if still valid
  if (globalBroker && (now - brokerInitTime) < BROKER_CACHE_TTL) {
    console.log('[Broker] Using cached global broker instance')
    return globalBroker
  }
  
  console.log('[Broker] Initializing new broker instance...')
  
  // Log environment status on first initialization
  logEnvironmentStatus()

  const rpcUrl = getRpcUrl()
  const servingAddr = SERVING_ADDR
  const ledger = getComputeLedgerContract()
  const inference = getComputeInferenceContract()
  const pk = getPrivateKey()
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')

  // Use rate-limited provider and wallet
  const provider = getRateLimitedProvider()
  const signer = createRateLimitedWallet(pk)

  console.log('[Broker] Using rate-limited provider with enhanced throttling')

  // Verify contracts are deployed with rate limiting
  try {
    await Promise.all([
      assertContractDeployed(provider, servingAddr),
      assertContractDeployed(provider, ledger),
      assertContractDeployed(provider, inference)
    ])
  } catch (error: any) {
    console.warn('[Broker] Contract verification failed (non-critical):', error.message)
    // Continue anyway - contracts might be deployed but network issues prevent verification
  }

  try {
    console.log('[Broker] Creating 0G SDK broker with rate limiting...')
    const newBroker = await createZGComputeNetworkBroker(
      signer,
      ledger,
      inference,
      servingAddr
    )
    
    console.log('[Broker] 0G SDK broker created successfully')
    
    newBroker.signer = signer
    newBroker.signerAddress = signer.address
    
    // Add safe ledger methods
    newBroker.ledgerSafe = ledgerSafe

    // Add fine-tuning support with rate limiting
    await addFineTuningSupport(newBroker, signer)

    // Cache the broker globally
    globalBroker = newBroker
    brokerInitTime = now
    broker = newBroker // Keep compatibility

    console.log('[Broker] Broker initialized and cached successfully', {
      signerAddress: newBroker.signerAddress,
      servingAddress: servingAddr,
      ledgerAddress: ledger,
      cacheExpiry: new Date(now + BROKER_CACHE_TTL).toISOString()
    })

    return newBroker
  } catch (e: any) {
    console.error('[Broker] Failed to create 0G SDK broker:', e)
    throw new Error(`Failed to start 0G SDK: ${e.message}`)
  }
}

async function addFineTuningSupport(broker: any, signer: Wallet) {
  const serving = getServingContract(signer)
  const ledger = getLedgerContract(signer)

  broker.fineTuning = {
    accountExists: async (user: string, provider: string) => {
      try {
        return await serving.accountExists(user, provider)
      } catch (e: any) {
        throw formatError(e, 0)
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
        throw formatError(e, 0)
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
          const gas = await serving.addAccount.estimateGas(user, provider, info, { value })
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
        throw formatError(e, 0)
      }
    },

    depositFund: async (
      user: string,
      provider: string,
      cancel: bigint,
      amountEth: string
    ) => {
      try {
        console.log('[fine] depositFund:start', { user, provider, amountEth })
        
        // Convert amount to number for SDK (SDK expects OG as number)
        const amountOG = parseFloat(amountEth)
        
        // Try to get existing ledger first
        let account;
        let hasExistingAccount = false;
        try {
          account = await broker.ledger.getLedger();
          hasExistingAccount = true;
          console.log('[fine] depositFund:existing-account', {
            balance: ethers.formatEther(account[0]),
            locked: ethers.formatEther(account[1])
          });
        } catch (error) {
          console.log('[fine] depositFund:no-existing-account');
        }
        
        // Use appropriate method based on account existence
        if (hasExistingAccount) {
          // Use depositFund for existing accounts (SDK expects number in OG)
          try {
            console.log('[fine] Calling SDK depositFund with amount:', amountOG)
            await broker.ledger.depositFund(amountOG)
            console.log('[fine] depositFund:existing-account:completed')
          } catch (depositError: any) {
            console.log('[fine] depositFund:existing-account:error', depositError.message)
            // If depositFund fails, the account might be in an inconsistent state
            // Let's try to handle the specific "Ledger already exists" error
            if (depositError.message && depositError.message.includes('Ledger already exists')) {
              console.log('[fine] depositFund:handling-ledger-exists-error')
              // The error suggests the account exists but depositFund failed
              // This might be a timing issue or SDK inconsistency
              throw new Error(`Deposit failed: Account exists but unable to add funds. Current balance: ${ethers.formatEther(account[0])} OG. Please try again.`)
            }
            throw depositError
          }
        } else {
          // Use addLedger for new accounts (SDK expects number in OG)
          try {
            console.log('[fine] Calling SDK addLedger with amount:', amountOG)
            await broker.ledger.addLedger(amountOG)
            console.log('[fine] depositFund:new-account:completed')
          } catch (addError: any) {
            console.log('[fine] depositFund:new-account:error', addError.message)
            // If addLedger fails with "already exists", account was created between our check
            if (addError.message && addError.message.includes('Ledger already exists')) {
              console.log('[fine] depositFund:race-condition-detected, retrying with depositFund')
              // Retry with depositFund since account now exists
              await broker.ledger.depositFund(amountOG)
              console.log('[fine] depositFund:race-condition:resolved')
            } else {
              throw addError
            }
          }
        }
        
        // Create a mock transaction response since SDK doesn't return transaction objects
        const mockTxHash = `0x${Date.now().toString(16).padStart(64, '0')}`
        const txUrl = formatTxUrl(mockTxHash)

        // SDK handles transaction internally, so we return a success response
        console.log('[fine] depositFund:success', { mockTxHash, amountOG })

        return { txHash: mockTxHash, txUrl, status: 'completed' }
      } catch (e: any) {
        throw formatError(e, 0)
      }
    },



    acknowledgeDeliverable: async (provider: string, index: bigint) => {
      try {
        const tx = await serving.acknowledgeDeliverable(provider, index)
        return await tx.wait()
      } catch (e: any) {
        throw formatError(e, 0)
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
        throw formatError(e, 0)
      }
    },

    acknowledgeProviderSigner: async (provider: string) => {
      try {
        console.log('[fine] acknowledgeProviderSigner:start', { provider })
        
        // Check cache first to avoid redundant calls
        const isAlreadyAcknowledged = await isProviderAcknowledged(provider)
        if (isAlreadyAcknowledged) {
          console.log('[fine] Provider already acknowledged (cached), skipping')
          return { cached: true, provider }
        }
        
        // Use the official SDK broker method for inference acknowledge
        if (!broker.inference || typeof broker.inference.acknowledgeProviderSigner !== 'function') {
          throw new Error('SDK inference.acknowledgeProviderSigner not available')
        }
        
        console.log('[fine] Calling SDK acknowledgeProviderSigner...')
        const result = await broker.inference.acknowledgeProviderSigner(provider)
        
        // Mark as acknowledged in cache
        markProviderAcknowledged(provider)
        
        console.log('[fine] acknowledgeProviderSigner:success', result)
        return result
      } catch (e: any) {
        console.error('[fine] acknowledgeProviderSigner:error', e)
        
        // If error suggests already acknowledged, cache it
        if (e.message && (
          e.message.includes('already acknowledged') || 
          e.message.includes('AlreadyAcknowledged') ||
          e.message.includes('signer is already acknowledged')
        )) {
          console.log('[fine] Provider was already acknowledged, caching result')
          markProviderAcknowledged(provider)
          return { alreadyAcknowledged: true, provider }
        }
        
        throw formatError(e, 0)
      }
    },

    createTask: async (
      provider: string,
      model: string,
      dataSize: number,
      datasetHash: string,
      configPath: string
    ) => {
      try {
        console.log('[fine] createTask:start', { provider, model, dataSize, datasetHash })
        
        // Always use direct provider API calls as per 0G specification
        console.log('[fine] createTask:using-provider-api-only')
        
        // Make direct HTTP call to provider
        const userAddress = broker.signerAddress
        const providerUrl = getProviderUrl(provider)
        const createTaskUrl = `${providerUrl}/v1/user/${userAddress}/task`
        
        // Get proper headers using broker inference module
        const headers = await broker.inference.getRequestHeaders(provider, configPath)
        
        const response = await fetch(createTaskUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            provider,
            model,
            dataSize,
            datasetHash,
            config: configPath
          })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[fine] createTask:provider-api-error', { 
            status: response.status, 
            statusText: response.statusText, 
            error: errorText 
          })
          throw new Error(`Provider API error: ${response.status} ${response.statusText}: ${errorText}`)
        }
        
        // Expect 204 No Content according to 0G specification
        let result
        if (response.status === 204) {
          // 204 No Content is success, no response body expected
          const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          console.log('[fine] createTask:success-204', { taskId })
          return taskId
        } else {
          // If not 204, try to parse JSON response
          result = await response.json()
          const taskId = result.taskId || result.id || `task_${Date.now()}`
          console.log('[fine] createTask:success-json', { taskId, result })
          return taskId
        }
      } catch (e: any) {
        console.error('[fine] createTask:error', e)
        throw formatError(e, 0)
      }
    }
  }
}


export { getFineTuneProvider }

// Provider URL mapping helper
function getProviderUrl(providerAddress: string): string {
  // Map provider addresses to their URLs
  const providerUrls: Record<string, string> = {
    '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f': 'http://50.145.48.68:30080',
    '0xf07240Efa67755B5311bc75784a061eDB47165Dd': 'http://50.145.48.68:30080',
    '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3': 'http://50.145.48.68:30080'
  }
  
  return providerUrls[providerAddress] || 'http://50.145.48.68:30080'
}

export async function getBroker() {
  return getBrokerOrThrow()
}
