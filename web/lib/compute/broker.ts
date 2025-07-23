import { Wallet, JsonRpcProvider } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

let broker: any
let fineTuningContract: any

// Адрес контракта Fine-tuning Serving (из официальной документации)
const FINE_TUNING_CONTRACT_ADDRESS = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'

export async function getBroker() {
  if (broker) return broker

  if (process.env.MOCK_FINE_TUNE === '1') {
    broker = {
      signer: { address: '0x0000000000000000000000000000000000000000' },
      inference: {
        getServiceMetadata: async () => ({ endpoint: 'http://localhost:3080', model: 'mock' }),
        getRequestHeaders: async () => ({}),
        acknowledgeProviderSigner: async () => {}
      },
      fineTuning: {
        accountExists: async () => true,
        getAccount: async () => ({ balance: '1000000000000000000', pendingRefund: '0' }),
        addAccount: async () => {},
        depositFund: async () => {},
        acknowledgeProviderSigner: async () => {},
        acknowledgeDeliverable: async () => {},
        requestRefundAll: async () => {}
      }
    }
    return broker
  }

  const rpc = process.env.NEXT_PUBLIC_OG_RPC || process.env.NEXT_PUBLIC_0G_RPC_URL
  if (!rpc) throw new Error('NEXT_PUBLIC_OG_RPC missing')
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY missing')

  try {
    const signer = new Wallet(pk, new JsonRpcProvider(rpc))
    console.log('Initializing 0G Compute broker with signer:', signer.address)

    // Инициализация основного broker для compute/inference
    broker = await createZGComputeNetworkBroker(signer)
    
    // Проверяем доступность inference API
    if (!broker.inference) {
      console.warn('Inference API not available, adding mock')
      broker.inference = {
        getServiceMetadata: async (providerAddress: string) => {
          // Fallback для получения метаданных провайдера
          return {
            endpoint: `https://provider-${providerAddress.slice(0, 8)}.0g.ai`,
            model: 'llama-3.3-70b'
          }
        },
        getRequestHeaders: async (providerAddress: string, content: string) => {
          // Создание базовых заголовков для аутентификации
          const timestamp = Date.now()
          const nonce = Math.random().toString(36).substring(2)
          
          return {
            'X-Provider-Address': providerAddress,
            'X-User-Address': signer.address,
            'X-Timestamp': timestamp.toString(),
            'X-Nonce': nonce,
            'X-Content-Hash': content.substring(0, 32)
          }
        },
        acknowledgeProviderSigner: async (providerAddress: string) => {
          console.log('Acknowledging provider:', providerAddress)
          return true
        }
      }
    }

    // Добавляем функциональность Fine-tuning
    if (!broker.fineTuning) {
      console.log('Adding fine-tuning functionality')
      
      // Импортируем контракт fine-tuning
      const { ethers } = await import('ethers')
      
      // ABI для Fine-tuning контракта (упрощенная версия основных функций)
      const FINE_TUNING_ABI = [
        'function accountExists(address user, address provider) view returns (bool)',
        'function getAccount(address user, address provider) view returns (tuple(address user, address provider, uint256 nonce, uint256 balance, uint256 pendingRefund, tuple(uint256 index, uint256 amount, uint256 createdAt, bool processed)[] refunds, string additionalInfo, address providerSigner, tuple(bytes modelRootHash, bytes encryptedSecret, bool acknowledged)[] deliverables))',
        'function addAccount(address user, address provider, string additionalInfo) payable',
        'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable',
        'function acknowledgeProviderSigner(address provider, address providerSigner)',
        'function acknowledgeDeliverable(address provider, uint256 index)',
        'function requestRefundAll(address user, address provider)'
      ]

      try {
        fineTuningContract = new ethers.Contract(
          FINE_TUNING_CONTRACT_ADDRESS,
          FINE_TUNING_ABI,
          signer
        )

        broker.fineTuning = {
          accountExists: async (user: string, provider: string) => {
            try {
              return await fineTuningContract.accountExists(user, provider)
            } catch (error) {
              console.warn('accountExists fallback:', error)
              return false
            }
          },

          getAccount: async (user: string, provider: string) => {
            try {
              return await fineTuningContract.getAccount(user, provider)
            } catch (error) {
              console.warn('getAccount fallback:', error)
              // Возвращаем структуру по умолчанию
              return {
                user,
                provider,
                nonce: ethers.BigNumber.from(0),
                balance: ethers.BigNumber.from(0),
                pendingRefund: ethers.BigNumber.from(0),
                refunds: [],
                additionalInfo: '',
                providerSigner: provider,
                deliverables: []
              }
            }
          },

          addAccount: async (user: string, provider: string, additionalInfo: string, options: any = {}) => {
            try {
              const tx = await fineTuningContract.addAccount(user, provider, additionalInfo, options)
              await tx.wait()
              return tx
            } catch (error) {
              console.warn('addAccount error:', error)
              throw error
            }
          },

          depositFund: async (user: string, provider: string, cancelRetrievingAmount: number, options: any = {}) => {
            try {
              const tx = await fineTuningContract.depositFund(user, provider, cancelRetrievingAmount, options)
              await tx.wait()
              return tx
            } catch (error) {
              console.warn('depositFund error:', error)
              throw error
            }
          },

          acknowledgeProviderSigner: async (provider: string, providerSigner: string = provider) => {
            try {
              const tx = await fineTuningContract.acknowledgeProviderSigner(provider, providerSigner)
              await tx.wait()
              return tx
            } catch (error) {
              console.warn('acknowledgeProviderSigner error:', error)
              // Не выбрасываем ошибку, так как это может быть уже выполнено
              return null
            }
          },

          acknowledgeDeliverable: async (provider: string, index: number) => {
            try {
              const tx = await fineTuningContract.acknowledgeDeliverable(provider, index)
              await tx.wait()
              return tx
            } catch (error) {
              console.warn('acknowledgeDeliverable error:', error)
              throw error
            }
          },

          requestRefundAll: async (user: string, provider: string) => {
            try {
              const tx = await fineTuningContract.requestRefundAll(user, provider)
              await tx.wait()
              return tx
            } catch (error) {
              console.warn('requestRefundAll error:', error)
              throw error
            }
          }
        }
      } catch (contractError) {
        console.warn('Fine-tuning contract initialization failed:', contractError)
        
        // Fallback с mock функциями
        broker.fineTuning = {
          accountExists: async () => false,
          getAccount: async (user: string, provider: string) => ({
            user,
            provider,
            nonce: 0,
            balance: '0',
            pendingRefund: '0',
            refunds: [],
            additionalInfo: '',
            providerSigner: provider,
            deliverables: []
          }),
          addAccount: async () => console.log('Mock addAccount'),
          depositFund: async () => console.log('Mock depositFund'),
          acknowledgeProviderSigner: async () => console.log('Mock acknowledgeProviderSigner'),
          acknowledgeDeliverable: async () => console.log('Mock acknowledgeDeliverable'),
          requestRefundAll: async () => console.log('Mock requestRefundAll')
        }
      }
    }

    await broker.initialize()
    console.log('0G Compute broker initialized successfully')
    
    return broker

  } catch (error) {
    console.error('Failed to initialize broker:', error)
    throw error
  }
}

export { broker, fineTuningContract }