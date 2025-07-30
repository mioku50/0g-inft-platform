// lib/compute/wallet-client.ts
// Клиентский модуль для работы с кошельком БЕЗ импорта 0G SDK

import { ethers } from 'ethers'

export interface WalletValidationResult {
  isValid: boolean
  error?: string
  details?: string
  address?: string
  balance?: string
  chainId?: string
}

/**
 * Валидация кошелька пользователя (клиентская версия)
 * Только базовые проверки без SDK
 */
export async function validateUserWalletClient(userSigner: ethers.Signer): Promise<WalletValidationResult> {
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
 * Проверить подключение кошелька
 */
export function isWalletConnected(userSigner: ethers.Signer | null): boolean {
  return userSigner !== null && userSigner !== undefined
}

/**
 * Получить адрес кошелька
 */
export async function getWalletAddress(userSigner: ethers.Signer): Promise<string | null> {
  try {
    return await userSigner.getAddress()
  } catch (error) {
    console.error('Failed to get wallet address:', error)
    return null
  }
}

/**
 * Получить баланс кошелька
 */
export async function getWalletBalance(userSigner: ethers.Signer): Promise<string | null> {
  try {
    const address = await userSigner.getAddress()
    const balance = await userSigner.provider?.getBalance(address)
    return balance ? ethers.formatEther(balance) : null
  } catch (error) {
    console.error('Failed to get wallet balance:', error)
    return null
  }
}

/**
 * Проверить сеть кошелька
 */
export async function checkWalletNetwork(userSigner: ethers.Signer): Promise<{
  chainId: number | null
  isCorrect: boolean
}> {
  try {
    const network = await userSigner.provider?.getNetwork()
    const chainId = network ? Number(network.chainId) : null
    return {
      chainId,
      isCorrect: chainId === 16601
    }
  } catch (error) {
    console.error('Failed to check wallet network:', error)
    return {
      chainId: null,
      isCorrect: false
    }
  }
}