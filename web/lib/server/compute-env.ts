// Server-only environment variables (no NEXT_PUBLIC_ prefix)
function getEnvOrThrow(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getEnvOptional(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue
}

// Core server variables
export const RPC_URL = getEnvOrThrow('OG_RPC_URL')
export const FINE_TUNING_SERVING = getEnvOrThrow('FINE_TUNING_SERVING_ADDRESS')
export const FINE_TUNE_PROVIDER = getEnvOrThrow('FINE_TUNE_PROVIDER')
export const PK = getEnvOrThrow('OG_COMPUTE_PRIVATE_KEY')

// Contract addresses
export const COMPUTE_LEDGER_CONTRACT = getEnvOptional(
  'COMPUTE_LEDGER_CONTRACT',
  '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa'
)
export const COMPUTE_INFERENCE_CONTRACT = getEnvOptional(
  'COMPUTE_INFERENCE_CONTRACT', 
  '0x5299bd255B76305ae08d7F95B270A485c6b95D54'
)

// Validation function for server-only usage
export function validateComputeEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  try {
    // Проверяем обязательные переменные
    const required = {
      'OG_RPC_URL': RPC_URL,
      'FINE_TUNING_SERVING_ADDRESS': FINE_TUNING_SERVING,
      'FINE_TUNE_PROVIDER': FINE_TUNE_PROVIDER,
      'OG_COMPUTE_PRIVATE_KEY': PK
    }
    
    for (const [name, value] of Object.entries(required)) {
      if (!value) {
        errors.push(`Missing required environment variable: ${name}`)
      }
    }
    
    // Валидация форматов
    if (RPC_URL && !RPC_URL.startsWith('http')) {
      errors.push('OG_RPC_URL must be a valid HTTP URL')
    }
    
    if (FINE_TUNING_SERVING && !FINE_TUNING_SERVING.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('FINE_TUNING_SERVING_ADDRESS must be a valid Ethereum address')
    }
    
    if (FINE_TUNE_PROVIDER && !FINE_TUNE_PROVIDER.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('FINE_TUNE_PROVIDER must be a valid Ethereum address')
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
      errors.push('COMPUTE_LEDGER_CONTRACT must be a valid Ethereum address')
    }
    
    if (COMPUTE_INFERENCE_CONTRACT && !COMPUTE_INFERENCE_CONTRACT.match(/^0x[a-fA-F0-9]{40}$/)) {
      errors.push('COMPUTE_INFERENCE_CONTRACT must be a valid Ethereum address')
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
    const { JsonRpcProvider, Network } = await import('ethers')
    
    // Создаем провайдер с явным network для избежания ENS ошибок
    const provider = new JsonRpcProvider(
      { url: RPC_URL },
      new Network('0g-testnet', 16601)
    )
    
    // Тестируем подключение
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)
    
    console.log(`✅ RPC connection successful, Chain ID: ${chainId}`)
    
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
    const { Wallet, JsonRpcProvider, Network, formatEther } = await import('ethers')
    
    // Создаем провайдер с явным network
    const provider = new JsonRpcProvider(
      { url: RPC_URL },
      new Network('0g-testnet', 16601)
    )
    
    // Нормализуем приватный ключ
    const normalizedPK = PK.startsWith('0x') ? PK : `0x${PK}`
    const wallet = new Wallet(normalizedPK, provider)
    
    const address = wallet.address
    const balance = await provider.getBalance(address)
    const balanceEth = formatEther(balance)
    
    console.log(`✅ Wallet address: ${address}`)
    console.log(`✅ Wallet balance: ${balanceEth} OG`)
    
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
  COMPUTE_LEDGER_CONTRACT,
  COMPUTE_INFERENCE_CONTRACT,
  isValid: () => validateComputeEnvironment().isValid,
  validateFull: validateFullEnvironment
}
