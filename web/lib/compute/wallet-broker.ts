// lib/compute/wallet-broker.ts
import { ethers } from 'ethers'
import { 
  getRpcUrl,
  getComputeLedgerContract, 
  getComputeInferenceContract,
  validateComputeEnvironment
} from '@/lib/server/compute-env'

const SERVING_ADDR = (
  process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS ??
  process.env.FINE_TUNING_SERVING_ADDRESS
) as string

const EXPECTED_CHAIN_ID = 16601 // Galileo Testnet V3

/**
 * Создает broker с кошельком пользователя (для фронтенда)
 * DISABLED: Use clientBroker.ts for non-custodial operations
 */
export async function createUserWalletBroker(userSigner: ethers.Signer) {
  throw new Error('Server-side wallet broker is disabled. Use clientBroker.ts for non-custodial operations.')
}

/**
 * Проверяет подключение и готовность кошелька пользователя
 */
export async function validateUserWallet(userSigner: ethers.Signer): Promise<{
  isValid: boolean
  errors: string[]
  warnings: string[]
  userAddress?: string
  balance?: string
  chainId?: number
}> {
  const errors: string[] = []
  const warnings: string[] = []
  let userAddress: string | undefined
  let balance: string | undefined
  let chainId: number | undefined

  try {
    // Проверка подключения
    if (!userSigner) {
      errors.push('Wallet not connected')
      return { isValid: false, errors, warnings }
    }

    // Получение адреса
    userAddress = await userSigner.getAddress()
    
    // Проверка провайдера
    if (!userSigner.provider) {
      errors.push('Wallet provider not available')
      return { isValid: false, errors, warnings, userAddress }
    }

    // Проверка сети
    const network = await userSigner.provider.getNetwork()
    chainId = Number(network.chainId)
    
    if (chainId !== EXPECTED_CHAIN_ID) {
      errors.push(`Wrong network. Expected Chain ID: ${EXPECTED_CHAIN_ID}, got: ${chainId}`)
    }

    // Проверка баланса
    const balanceWei = await userSigner.provider.getBalance(userAddress)
    balance = ethers.formatEther(balanceWei)
    
    if (balanceWei < ethers.parseEther('0.001')) {
      warnings.push(`Low balance: ${balance} OG. You may need more funds for transactions.`)
    }

    if (balanceWei === 0n) {
      errors.push('Insufficient balance. Please add funds to your wallet.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      userAddress,
      balance,
      chainId
    }

  } catch (error) {
    console.error('[wallet-broker] Validation error:', error)
    errors.push(`Wallet validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return {
      isValid: false,
      errors,
      warnings,
      userAddress,
      balance,
      chainId
    }
  }
}

/**
 * Запрашивает подпись сообщения у пользователя для верификации
 */
export async function requestUserSignature(
  userSigner: ethers.Signer, 
  message: string
): Promise<string> {
  try {
    console.log('[wallet-broker] Requesting user signature for message:', message)
    const signature = await userSigner.signMessage(message)
    console.log('[wallet-broker] Signature received successfully')
    return signature
  } catch (error) {
    console.error('[wallet-broker] Signature request failed:', error)
    throw new Error(`Failed to get user signature: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Проверяет разрешения (allowance) для контракта
 */
export async function checkAllowance(
  userSigner: ethers.Signer,
  tokenAddress: string,
  spenderAddress: string
): Promise<bigint> {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function allowance(address owner, address spender) view returns (uint256)'],
      userSigner
    )
    
    const userAddress = await userSigner.getAddress()
    const allowance = await tokenContract.allowance(userAddress, spenderAddress)
    
    console.log('[wallet-broker] Current allowance:', ethers.formatEther(allowance))
    return allowance
  } catch (error) {
    console.error('[wallet-broker] Failed to check allowance:', error)
    throw error
  }
}

/**
 * Запрашивает approve у пользователя
 */
export async function requestApproval(
  userSigner: ethers.Signer,
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint
): Promise<ethers.ContractTransaction> {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      userSigner
    )
    
    console.log('[wallet-broker] Requesting approval for amount:', ethers.formatEther(amount))
    const tx = await tokenContract.approve(spenderAddress, amount)
    
    console.log('[wallet-broker] Approval transaction sent:', tx.hash)
    return tx
  } catch (error) {
    console.error('[wallet-broker] Approval request failed:', error)
    throw new Error(`Failed to approve tokens: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}