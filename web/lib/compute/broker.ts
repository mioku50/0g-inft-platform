// web/lib/compute/broker.ts
import 'dotenv/config'
import { ethers } from 'ethers'
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker'

let brokerInstance: any = null

export async function getBroker() {
  if (brokerInstance) return brokerInstance
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_COMPUTE_PRIVATE_KEY not found')
  }
  
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  const wallet = new ethers.Wallet(privateKey, provider)
  
  brokerInstance = await createZGComputeNetworkBroker(wallet)
  
  // Логируем доступные методы для отладки
  console.log('Broker initialized with methods:', {
    hasLedger: !!brokerInstance.ledger,
    hasInference: !!brokerInstance.inference,
    hasProvider: !!brokerInstance.provider,
    ledgerMethods: brokerInstance.ledger ? Object.keys(brokerInstance.ledger) : [],
    inferenceMethods: brokerInstance.inference ? Object.keys(brokerInstance.inference) : []
  })
  
  return brokerInstance
}

// Вспомогательная функция для получения информации о провайдерах
export async function getProviderInfo() {
  const broker = await getBroker()
  
  // Проверяем доступные методы
  if (broker.listService) {
    return await broker.listService()
  } else if (broker.inference && broker.inference.listService) {
    return await broker.inference.listService()
  } else {
    console.log('listService method not found, using default providers')
    // Возвращаем известные провайдеры
    return [
      {
        provider: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
        model: 'llama-3.3-70b-instruct',
        serviceType: 'inference',
        verifiability: 'TeeML'
      },
      {
        provider: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
        model: 'deepseek-r1-70b',
        serviceType: 'inference',
        verifiability: 'TeeML'
      }
    ]
  }
}