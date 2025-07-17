// web/lib/contracts/erc7857-abi.ts
export const ERC7857_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ERC7857_CONTRACT_ADDRESS || '0x027eFE8FE350b1CAed2cca7a662EBF4520C237E2'
export const TEE_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_TEE_VERIFIER_ADDRESS || '0x5c8B03FE76e9bDD532B0Fa83A7c21E88d1B69a35'

// Импортируйте ABI из JSON файла или вставьте напрямую
export const ERC7857_ABI = [
  // ... ABI контракта AgentNFT
] as const

export const TEE_VERIFIER_ABI = [
  // ... ABI контракта TEEVerifier
] as const