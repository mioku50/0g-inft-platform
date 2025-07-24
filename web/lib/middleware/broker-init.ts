// lib/middleware/broker-init.ts
import { getBroker } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import React from 'react'

let isInitialized = false
let initPromise: Promise<any> | null = null

/**
 * Инициализация broker и fine-tuning сервиса
 */
export async function initializeBrokerServices() {
  if (isInitialized) return
  
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    try {
      console.log('Initializing 0G Broker services...')
      
      // Инициализация основного broker
      const broker = await getBroker()
      
      if (!broker) {
        throw new Error('Failed to initialize broker')
      }

      // Инициализация fine-tuning сервиса
      const fineTuneService = new FineTuneService(broker)
      
      // Проверка и создание аккаунта если нужно
      try {
        await fineTuneService.initializeAccount()
        console.log('Fine-tuning account initialized')
      } catch (error) {
        console.warn('Account initialization skipped:', error)
      }

      isInitialized = true
      console.log('0G Broker services initialized successfully')
      
      return { broker, fineTuneService }
    } catch (error) {
      console.error('Failed to initialize broker services:', error)
      initPromise = null
      throw error
    }
  })()

  return initPromise
}

/**
 * Middleware для API routes
 */
export function withBrokerInit(handler: Function) {
  return async (req: any, res: any) => {
    try {
      await initializeBrokerServices()
      return handler(req, res)
    } catch (error) {
      console.error('Broker initialization failed:', error)
      return res.status(500).json({
        error: 'Service initialization failed',
        details: 'Please try again later'
      })
    }
  }
}

/**
 * Hook для использования в компонентах
 */
export function useBrokerInit() {
  const [isReady, setIsReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    initializeBrokerServices()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message))
  }, [])

  return { isReady, error }
}