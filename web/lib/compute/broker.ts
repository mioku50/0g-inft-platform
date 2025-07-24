// lib/compute/broker.ts
import { Wallet, JsonRpcProvider } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'
import { FINE_TUNING_SERVING_ABI } from '@/lib/contracts/abis'
import { Contract } from 'ethers'

let broker: any

// Официальный провайдер Fine-tuning
const FINE_TUNE_PROVIDER = process.env.OG_COMPUTE_PROVIDER_ADDRESS || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
const FINE_TUNING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FINE_TUNING_CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'

export async function getBroker() {
  if (broker) return broker

  if (process.env.MOCK_FINE_TUNE === '1') {
    // Mock режим для разработки
    broker = createMockBroker()
    return broker
  }

  const rpc = process.env.NEXT_PUBLIC_0G_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY

  if (!rpc) throw new Error('NEXT_PUBLIC_0G_RPC_URL missing')
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  try {
    const signer = new Wallet(pk, new JsonRpcProvider(rpc))
    console.log('Initializing 0G Compute broker with signer:', signer.address)

    // ✅ Broker создается сразу готовым - initialize() больше НЕ НУЖЕН
    broker = await createZGComputeNetworkBroker(signer)
    
    // Добавляем Fine-tuning функциональность
    await addFineTuningSupport(broker, signer)

    console.log('0G Compute broker initialized successfully')
    return broker

  } catch (error) {
    console.error('Failed to initialize broker:', error)
    throw error
  }
}

async function addFineTuningSupport(broker: any, signer: Wallet) {
  try {
    // Создаем контракт для Fine-tuning
    const fineTuningContract = new Contract(
      FINE_TUNING_CONTRACT_ADDRESS,
      FINE_TUNING_SERVING_ABI,
      signer
    )

    // Добавляем Fine-tuning API к broker
    broker.fineTuning = {
      // Проверка существования аккаунта
      accountExists: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
        try {
          return await fineTuningContract.accountExists(user, provider)
        } catch (error) {
          console.warn('accountExists error:', error)
          return false
        }
      },

      // Получение аккаунта
      getAccount: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
        try {
          return await fineTuningContract.getAccount(user, provider)
        } catch (error) {
          console.warn('getAccount error:', error)
          return null
        }
      },

      // Создание аккаунта
      addAccount: async (user: string, provider: string = FINE_TUNE_PROVIDER, additionalInfo: string = '', options: any = {}) => {
        try {
          const tx = await fineTuningContract.addAccount(user, provider, additionalInfo, options)
          await tx.wait()
          return tx
        } catch (error) {
          console.error('addAccount error:', error)
          throw error
        }
      },

      // Пополнение баланса
      depositFund: async (user: string, provider: string = FINE_TUNE_PROVIDER, cancelRetrievingAmount: number = 0, options: any = {}) => {
        try {
          const tx = await fineTuningContract.depositFund(user, provider, cancelRetrievingAmount, options)
          await tx.wait()
          return tx
        } catch (error) {
          console.error('depositFund error:', error)
          throw error
        }
      },

      // Подтверждение провайдера
      acknowledgeProviderSigner: async (provider: string = FINE_TUNE_PROVIDER, providerSigner: string = FINE_TUNE_PROVIDER) => {
        try {
          const tx = await fineTuningContract.acknowledgeProviderSigner(provider, providerSigner)
          await tx.wait()
          return tx
        } catch (error) {
          console.warn('acknowledgeProviderSigner error:', error)
          // Не выбрасываем ошибку, может быть уже выполнено
          return null
        }
      },

      // Подтверждение получения модели
      acknowledgeDeliverable: async (provider: string = FINE_TUNE_PROVIDER, index: number = 0) => {
        try {
          const tx = await fineTuningContract.acknowledgeDeliverable(provider, index)
          await tx.wait()
          return tx
        } catch (error) {
          console.error('acknowledgeDeliverable error:', error)
          throw error
        }
      },

      // Запрос возврата средств
      requestRefundAll: async (user: string, provider: string = FINE_TUNE_PROVIDER) => {
        try {
          const tx = await fineTuningContract.requestRefundAll(user, provider)
          await tx.wait()
          return tx
        } catch (error) {
          console.error('requestRefundAll error:', error)
          throw error
        }
      }
    }

    console.log('Fine-tuning functionality added to broker')
  } catch (error) {
    console.error('Failed to add fine-tuning support:', error)
    throw error
  }
}

function createMockBroker() {
  return {
    signer: { address: '0x0000000000000000000000000000000000000000' },
    inference: {
      getServiceMetadata: async () => ({ endpoint: 'http://localhost:3080', model: 'mock' }),
      getRequestHeaders: async () => ({}),
      acknowledgeProviderSigner: async () => {}
    },
    fineTuning: {
      accountExists: async () => true,
      getAccount: async () => ({ 
        balance: '1000000000000000000', 
        pendingRefund: '0',
        deliverables: []
      }),
      addAccount: async () => {},
      depositFund: async () => {},
      acknowledgeProviderSigner: async () => {},
      acknowledgeDeliverable: async () => {},
      requestRefundAll: async () => {}
    }
  }
}

export { broker }
export { FINE_TUNE_PROVIDER }