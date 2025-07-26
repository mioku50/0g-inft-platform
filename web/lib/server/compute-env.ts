import { requireEnv, CHAIN_ID } from '../constants'

// Server-only environment variables validation
export const RPC_URL = requireEnv('NEXT_PUBLIC_0G_RPC_URL')
export const FINE_TUNING_SERVING = requireEnv('FINE_TUNING_CONTRACT')
export const FINE_TUNE_PROVIDER = requireEnv('NEXT_PUBLIC_FINE_TUNE_PROVIDER')
export const PK = requireEnv('OG_COMPUTE_PRIVATE_KEY')

// Дополнительные ENV для 0G Compute
export const COMPUTE_LEDGER_CONTRACT = requireEnv('LEDGER_CONTRACT')
export const COMPUTE_INFERENCE_CONTRACT = requireEnv('INFERENCE_CONTRACT')

// Validation function for server-only usage
export function validateComputeEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  try {
    // Обязательные переменные
    if (!RPC_URL) errors.push('Missing NEXT_PUBLIC_0G_RPC_URL')
    if (!FINE_TUNING_SERVING) errors.push('Missing FINE_TUNING_CONTRACT')
    if (!FINE_TUNE_PROVIDER) errors.push('Missing NEXT_PUBLIC_FINE_TUNE_PROVIDER')
    if (!PK) errors.push('Missing OG_COMPUTE_PRIVATE_KEY')
    
    // Валидация форматов
    if (RPC_URL && !RPC_URL.startsWith('http')) {
      errors.push('NEXT_PUBLIC_0G_RPC_URL must be a valid HTTP URL')
    }
    
    if (FINE_TUNING_SERVING && !FINE_TUNING_SERVING.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('FINE_TUNING_CONTRACT must be a valid Ethereum address')
    }
    
    if (FINE_TUNE_PROVIDER && !FINE_TUNE_PROVIDER.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('NEXT_PUBLIC_FINE_TUNE_PROVIDER must be a valid Ethereum address')
    }
    
    if (PK) {
      // Поддерживаем как с 0x префиксом, так и без
      const pkPattern = /^(0x)?[a-fA-F0-9]{64}$/
      if (!PK.match(pkPattern)) {
        errors.push('OG_COMPUTE_PRIVATE_KEY must be a valid 64-character private key (with or without 0x prefix)')
      }
    }
    
    // Валидация дополнительных контрактов
    if (COMPUTE_LEDGER_CONTRACT && !COMPUTE_LEDGER_CONTRACT.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('LEDGER_CONTRACT must be a valid Ethereum address')
    }

    if (COMPUTE_INFERENCE_CONTRACT && !COMPUTE_INFERENCE_CONTRACT.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('INFERENCE_CONTRACT must be a valid Ethereum address')
    }
    
    // Валидация сети (проверяем известные RPC)
    const knownRPCs = [
      'https://evmrpc-testnet.0g.ai',
      'https://testnet-rpc.0g.ai',
      'https://rpc-testnet.0g.ai'
    ]
    
    if (RPC_URL && !knownRPCs.some(rpc => RPC_URL.includes(rpc.replace('https://', '')))) {
      console.warn(`Warning: Using unknown RPC URL: ${RPC_URL}`)
    }
    
  } catch (e: any) {
    errors.push(`Environment validation error: ${e.message}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Асинхронная проверка подключения к RPC
export async function validateRPCConnection(): Promise<{ isValid: boolean; error?: string; chainId?: number }> {
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: '0g', chainId: CHAIN_ID })
    
    // Тестируем подключение
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)
    
    console.log(`RPC connection successful, Chain ID: ${chainId}`)
    
    // Проверяем, что это 0G сеть
    const expectedChainIds = [16600, 16601] // 0G testnet chain IDs
    if (!expectedChainIds.includes(chainId)) {
      return {
        isValid: false,
        error: `Unexpected chain ID: ${chainId}. Expected 0G testnet (16600 or 16601)`,
        chainId
      }
    }
    
    return { isValid: true, chainId }
    
  } catch (error: any) {
    return {
      isValid: false,
      error: `RPC connection failed: ${error.message}`
    }
  }
}

// Проверка приватного ключа и баланса
export async function validateWalletSetup(): Promise<{ isValid: boolean; error?: string; address?: string; balance?: string }> {
  try {
    const { ethers } = await import('ethers')
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: '0g', chainId: CHAIN_ID })
    
    // Нормализуем приватный ключ
    const normalizedPK = PK.startsWith('0x') ? PK : `0x${PK}`
    const wallet = new ethers.Wallet(normalizedPK, provider)
    
    const address = wallet.address
    const balance = await provider.getBalance(address)
    const balanceEth = ethers.formatEther(balance)
    
    console.log(`Wallet address: ${address}`)
    console.log(`Wallet balance: ${balanceEth} OG`)
    
    // Проверяем минимальный баланс для транзакций
    const minBalance = ethers.parseEther('0.001') // 0.001 OG минимум
    if (balance < minBalance) {
      return {
        isValid: false,
        error: `Insufficient balance: ${balanceEth} OG. Need at least 0.001 OG for transactions.`,
        address,
        balance: balanceEth
      }
    }
    
    return {
      isValid: true,
      address,
      balance: balanceEth
    }
    
  } catch (error: any) {
    return {
      isValid: false,
      error: `Wallet setup error: ${error.message}`
    }
  }
}

// Полная валидация среды
export async function validateFullEnvironment(): Promise<{ 
  isValid: boolean; 
  errors: string[]; 
  warnings: string[];
  rpcStatus?: any;
  walletStatus?: any;
}> {
  const warnings: string[] = []
  const { errors } = validateComputeEnvironment()
  
  if (errors.length > 0) {
    return { isValid: false, errors, warnings }
  }
  
  // Проверяем RPC подключение
  const rpcStatus = await validateRPCConnection()
  if (!rpcStatus.isValid) {
    errors.push(rpcStatus.error || 'RPC validation failed')
  }
  
  // Проверяем wallet setup
  const walletStatus = await validateWalletSetup()
  if (!walletStatus.isValid) {
    if (walletStatus.error?.includes('Insufficient balance')) {
      warnings.push(walletStatus.error)
    } else {
      errors.push(walletStatus.error || 'Wallet validation failed')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    rpcStatus,
    walletStatus
  }
}

// Export configuration object for easy access
export const COMPUTE_CONFIG = {
  RPC_URL,
  FINE_TUNING_SERVING,
  FINE_TUNE_PROVIDER,
  PK: PK.startsWith('0x') ? PK : `0x${PK}`, // Нормализованный ключ
  CHAIN_ID,
  COMPUTE_LEDGER_CONTRACT,
  COMPUTE_INFERENCE_CONTRACT,
  isValid: () => validateComputeEnvironment().isValid,
  validateFull: validateFullEnvironment
}

export { CHAIN_ID }
