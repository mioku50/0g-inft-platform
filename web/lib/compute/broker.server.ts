import 'server-only'

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
import { getRateLimitedProvider, createRateLimitedWallet } from '@/lib/server/rate-limited-provider'

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
  'event LedgerAdded(address indexed user, uint256 amount)',
  'event FundDeposited(address indexed user, uint256 amount)',
  'event TaskCreated(address indexed user, address indexed provider, bytes32 indexed taskId)',
] as const

// Кэш для брокеров
let brokerCache: Map<string, any> = new Map()
let brokerCacheTime: Map<string, number> = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

/**
 * Получить или создать брокер с кэшированием
 * ТОЛЬКО ДЛЯ СЕРВЕРНОГО ИСПОЛЬЗОВАНИЯ
 */
export async function getBroker() {
  try {
    const cacheKey = 'default-broker'
    const now = Date.now()
    
    // Проверяем кэш
    if (brokerCache.has(cacheKey) && brokerCacheTime.has(cacheKey)) {
      const cacheTime = brokerCacheTime.get(cacheKey)!
      if (now - cacheTime < CACHE_DURATION) {
        console.log('[broker.server] Using cached broker')
        return brokerCache.get(cacheKey)
      }
    }

    console.log('[broker.server] Creating new broker...')
    logEnvironmentStatus()

    const rpcUrl = getRpcUrl()
    const privateKey = getPrivateKey()
    
    if (!privateKey) {
      throw new Error('Private key not found in environment')
    }

    // Use rate-limited provider to prevent -32005 errors
    const signer = createRateLimitedWallet(privateKey)
    
    console.log('[broker.server] Signer address:', await signer.getAddress())
    
    const broker = await createZGComputeNetworkBroker(
      signer,
      getComputeLedgerContract(),
      getComputeInferenceContract(),
      undefined, // fineTuningCA
      undefined, // gasPrice
      undefined, // maxGasPrice
      undefined  // step
    )

    // Сохраняем в кэш
    brokerCache.set(cacheKey, broker)
    brokerCacheTime.set(cacheKey, now)
    
    console.log('[broker.server] Broker created successfully')
    return broker
  } catch (error) {
    console.error('[broker.server] Failed to create broker:', error)
    throw error
  }
}

/**
 * Получить брокер или выбросить ошибку
 */
export async function getBrokerOrThrow() {
  const broker = await getBroker()
  if (!broker) {
    throw new Error('Failed to initialize broker')
  }
  return broker
}

/**
 * Получить адрес подписанта
 */
export async function getSignerAddress(): Promise<string> {
  const privateKey = getPrivateKey()
  if (!privateKey) {
    throw new Error('Private key not found')
  }
  
  // Use rate-limited provider for address lookup too
  const signer = createRateLimitedWallet(privateKey)
  return await signer.getAddress()
}

/**
 * Создать брокер с пользовательским signer
 * ТОЛЬКО ДЛЯ СЕРВЕРНОГО ИСПОЛЬЗОВАНИЯ
 */
export async function createUserWalletBroker(userSigner: ethers.Wallet | ethers.JsonRpcSigner) {
  console.log('[broker.server] Creating user wallet broker...')
  
  const userAddress = await userSigner.getAddress()
  console.log('[broker.server] User address:', userAddress)
  
  // Проверка сети
  const network = await userSigner.provider?.getNetwork()
  if (network && Number(network.chainId) !== 16601) {
    throw new Error(`Wrong network. Please switch to Galileo Testnet V3 (Chain ID: 16601)`)
  }

  const broker = await createZGComputeNetworkBroker(
    userSigner,
    getComputeLedgerContract(),
    getComputeInferenceContract(),
    undefined,
    undefined,
    undefined,
    undefined
  )

  console.log('[broker.server] User wallet broker created successfully')
  return broker
}

/**
 * Валидация кошелька пользователя
 * ТОЛЬКО ДЛЯ СЕРВЕРНОГО ИСПОЛЬЗОВАНИЯ
 */
export async function validateUserWallet(userSigner: ethers.Wallet | ethers.JsonRpcSigner) {
  if (!userSigner) {
    return {
      isValid: false,
      error: 'Wallet not connected',
      details: 'Please connect your wallet first.'
    }
  }

  try {
    const userAddress = await userSigner.getAddress()
    const network = await userSigner.provider?.getNetwork()
    const balance = await userSigner.provider?.getBalance(userAddress)

    // Проверка сети
    if (network && Number(network.chainId) !== 16601) {
      return {
        isValid: false,
        error: 'Wrong network',
        details: `Please switch to Galileo Testnet V3 (Chain ID: 16601). Current: ${network.chainId}`
      }
    }

    // Проверка баланса
    if (balance && balance < ethers.parseEther('0.001')) {
      return {
        isValid: false,
        error: 'Insufficient balance',
        details: `Low balance: ${ethers.formatEther(balance)} OG. Please add funds.`
      }
    }

    return {
      isValid: true,
      address: userAddress,
      balance: balance ? ethers.formatEther(balance) : '0',
      chainId: network?.chainId?.toString() || 'unknown'
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Очистить кэш брокеров
 */
export function clearBrokerCache() {
  brokerCache.clear()
  brokerCacheTime.clear()
  console.log('[broker.server] Broker cache cleared')
}

/**
 * Получить контракт Serving
 */
export function getServingContract(signer: ethers.Wallet | ethers.JsonRpcSigner) {
  const servingAddress = getComputeInferenceContract()
  if (!servingAddress) {
    throw new Error('Serving contract address not found')
  }
  return new Contract(servingAddress, SERVING_ABI, signer)
}

/**
 * Получить контракт Ledger
 */
export function getLedgerContract(signer: ethers.Wallet | ethers.JsonRpcSigner) {
  const ledgerAddress = getComputeLedgerContract()
  if (!ledgerAddress) {
    throw new Error('Ledger contract address not found')
  }
  return new Contract(ledgerAddress, LEDGER_ABI, signer)
}