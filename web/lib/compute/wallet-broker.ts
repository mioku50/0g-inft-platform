// lib/compute/wallet-broker.ts
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
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

/**
 * Создает broker с кошельком пользователя (для фронтенда)
 * Требует подключенный кошелек через wagmi/ethers
 */
export async function createUserWalletBroker(userSigner: ethers.Signer) {
  // Validate environment
  const validation = validateComputeEnvironment()
  if (!validation.isValid) {
    throw new Error(`Environment validation failed: ${validation.errors.join(', ')}`)
  }

  if (!SERVING_ADDR) {
    throw new Error('FINE_TUNING_SERVING_ADDRESS not configured')
  }

  const ledgerAddress = getComputeLedgerContract()
  const inferenceAddress = getComputeInferenceContract()

  console.log('[wallet-broker] Initializing with user wallet:', {
    userAddress: await userSigner.getAddress(),
    servingAddress: SERVING_ADDR,
    ledgerAddress,
    inferenceAddress
  })

  try {
    const broker = await createZGComputeNetworkBroker(
      userSigner,
      ledgerAddress,
      inferenceAddress, 
      SERVING_ADDR
    )

    // Store user signer info
    broker.signer = userSigner
    broker.signerAddress = await userSigner.getAddress()
    broker.isUserWallet = true

    console.log('[wallet-broker] User wallet broker initialized successfully')
    return broker

  } catch (error: any) {
    console.error('[wallet-broker] Failed to initialize user broker:', error)
    throw new Error(`Failed to initialize user wallet broker: ${error.message}`)
  }
}

/**
 * Проверяет, подключен ли кошелек пользователя
 */
export function isWalletConnected(broker: any): boolean {
  return broker && broker.isUserWallet && broker.signerAddress
}

/**
 * Получает адрес подключенного кошелька
 */
export function getWalletAddress(broker: any): string | null {
  return broker?.signerAddress || null
}

/**
 * Проверяет баланс кошелька пользователя
 */
export async function checkWalletBalance(broker: any): Promise<string> {
  if (!isWalletConnected(broker)) {
    throw new Error('Wallet not connected')
  }

  try {
    const balance = await broker.signer.provider.getBalance(broker.signerAddress)
    return ethers.formatEther(balance)
  } catch (error: any) {
    console.error('[wallet-broker] Failed to check wallet balance:', error)
    throw new Error(`Failed to check wallet balance: ${error.message}`)
  }
}

/**
 * Запрашивает подпись транзакции у пользователя
 */
export async function requestTransactionSignature(
  broker: any,
  transaction: any
): Promise<string> {
  if (!isWalletConnected(broker)) {
    throw new Error('Wallet not connected')
  }

  try {
    console.log('[wallet-broker] Requesting transaction signature from user')
    const signedTx = await broker.signer.sendTransaction(transaction)
    console.log('[wallet-broker] Transaction signed:', signedTx.hash)
    return signedTx.hash
  } catch (error: any) {
    console.error('[wallet-broker] User rejected transaction:', error)
    throw new Error(`Transaction rejected by user: ${error.message}`)
  }
}