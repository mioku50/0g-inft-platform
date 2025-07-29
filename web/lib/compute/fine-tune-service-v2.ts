// lib/compute/fine-tune-service-v2.ts
import { getBroker, getFineTuneProvider } from './broker'
import { toWei, fromWei } from '@/lib/constants'

// Официальная схема задачи согласно CLI документации
export interface CreateTaskOptions {
  provider: string
  model: string
  datasetHash: string
  configPath?: any // Training parameters
  dataSize: number
  gasPrice?: string
}

export interface ModelInfo {
  name: string
  description: string
  hash?: string
  provider?: string
}

export interface ProviderInfo {
  address: string
  available: boolean
  pricePerByte: string
}

export class FineTuneServiceV2 {
  constructor(private broker: any) {}

  /**
   * Получение списка доступных провайдеров
   * Эквивалент: 0g-compute-cli list-providers
   */
  async listProviders(): Promise<ProviderInfo[]> {
    try {
      // Получаем все сервисы из контракта
      const services = await this.broker.fineTuning.getAllServices()
      
      const providers: ProviderInfo[] = []
      for (const service of services) {
        const metadata = await this.broker.fineTuning.getServiceMetadata(service.provider)
        providers.push({
          address: service.provider,
          available: service.isAvailable || true,
          pricePerByte: service.pricePerByte || '0.000000000000000001'
        })
      }
      
      return providers
    } catch (error) {
      console.error('Error listing providers:', error)
      // Возвращаем дефолтного провайдера если не можем получить список
      return [{
        address: getFineTuneProvider(),
        available: true,
        pricePerByte: '0.000000000000000001'
      }]
    }
  }

  /**
   * Получение списка доступных моделей
   * Эквивалент: 0g-compute-cli list-models
   */
  async listModels(provider?: string): Promise<{ predefined: ModelInfo[], provider: ModelInfo[] }> {
    const targetProvider = provider || getFineTuneProvider()
    
    // Предопределенные модели согласно документации
    const predefinedModels: ModelInfo[] = [
      {
        name: 'distilbert-base-uncased',
        description: 'DistilBERT is a transformers model, smaller and faster than BERT',
        hash: '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7'
      }
    ]

    // Получаем модели провайдера
    const providerModels: ModelInfo[] = []
    try {
      const { endpoint } = await this.broker.inference.getServiceMetadata(targetProvider)
      const response = await fetch(`${endpoint}/v1/models`)
      if (response.ok) {
        const models = await response.json()
        for (const model of models.provider || []) {
          providerModels.push({
            name: model.name,
            description: model.description,
            provider: targetProvider
          })
        }
      }
    } catch (error) {
      console.warn('Could not fetch provider models:', error)
    }

    return {
      predefined: predefinedModels,
      provider: providerModels
    }
  }

  /**
   * Получение шаблона использования модели
   * Эквивалент: 0g-compute-cli model-usage --provider <PROVIDER> --model <MODEL>
   */
  async getModelUsage(provider: string, model: string): Promise<any> {
    try {
      const { endpoint } = await this.broker.inference.getServiceMetadata(provider)
      const response = await fetch(`${endpoint}/v1/model/desc/${model}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get model usage: ${response.status}`)
      }
      
      const usage = await response.arrayBuffer()
      // Возвращаем конфигурацию или дефолтную
      return this.getDefaultTrainingConfig(model)
    } catch (error) {
      console.warn('Using default config due to error:', error)
      return this.getDefaultTrainingConfig(model)
    }
  }

  /**
   * Расчет размера токенов в датасете
   * Эквивалент: 0g-compute-cli calculate-token
   */
  async calculateTokenSize(model: string, datasetContent: string, provider?: string): Promise<number> {
    const targetProvider = provider || getFineTuneProvider()
    
    try {
      // Попытка получить token counter от провайдера
      const { endpoint } = await this.broker.inference.getServiceMetadata(targetProvider)
      const response = await fetch(`${endpoint}/v1/token-counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          text: datasetContent
        })
      })
      
      if (response.ok) {
        const { tokenCount } = await response.json()
        return tokenCount
      }
    } catch (error) {
      console.warn('Using fallback token calculation:', error)
    }
    
    // Fallback: простой подсчет по байтам
    // Согласно логам, размер файла 54 байта
    return new TextEncoder().encode(datasetContent).length
  }

  /**
   * Создание задачи fine-tuning
   * Эквивалент: 0g-compute-cli create-task
   */
  async createTask(options: CreateTaskOptions): Promise<string> {
    try {
      const { provider, model, datasetHash, configPath, dataSize } = options
      
      // 1. Проверяем провайдера
      console.log('Verifying provider...')
      const providerInfo = await this.verifyProvider(provider)
      if (!providerInfo.available) {
        throw new Error('Provider is not available')
      }

      // 2. Рассчитываем fee на основе размера данных и цены провайдера
      const pricePerByte = BigInt(providerInfo.pricePerByte || '1')
      const dataSizeInBytes = BigInt(dataSize || 0)
      const fee = dataSizeInBytes * pricePerByte
      
      console.log('Creating task with fee:', fee.toString(), 'neuron')

      // 3. Получаем nonce из аккаунта
      const account = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        provider
      )

      // 4. Подготавливаем параметры обучения
      const trainingParams = configPath || this.getDefaultTrainingConfig(model)

      // 5. Создаем задачу через SDK метод
      const tx = await this.broker.fineTuning.createTask(
        provider,
        model, // Используем название модели, а не hash
        datasetHash,
        trainingParams,
        fee
      )

      // 6. Ждем подтверждения транзакции
      const receipt = await tx.wait()
      
      // 7. Получаем ID задачи из событий
      const taskId = this.extractTaskIdFromReceipt(receipt)
      
      console.log('Created Task ID:', taskId)
      return taskId

    } catch (error) {
      console.error('Error creating task:', error)
      throw error
    }
  }

  /**
   * Мониторинг прогресса задачи
   * Эквивалент: 0g-compute-cli get-task
   */
  async getTaskStatus(provider: string, taskId: string): Promise<any> {
    try {
      const { endpoint } = await this.broker.inference.getServiceMetadata(provider)
      const response = await fetch(`${endpoint}/v1/user/${this.broker.signer.address}/task/${taskId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting task status:', error)
      throw error
    }
  }

  /**
   * Получение логов задачи
   * Эквивалент: 0g-compute-cli get-log
   */
  async getTaskLogs(provider: string, taskId: string): Promise<string[]> {
    try {
      const { endpoint } = await this.broker.inference.getServiceMetadata(provider)
      const response = await fetch(`${endpoint}/v1/user/${this.broker.signer.address}/task/${taskId}/logs`)
      
      if (!response.ok) {
        throw new Error(`Failed to get task logs: ${response.status}`)
      }

      const logs = await response.text()
      return logs.split('\n').filter(line => line.trim())
    } catch (error) {
      console.error('Error getting task logs:', error)
      return []
    }
  }

  /**
   * Подтверждение получения модели
   * Эквивалент: 0g-compute-cli acknowledge-model
   */
  async acknowledgeModel(provider: string, downloadPath?: string): Promise<string> {
    try {
      // Получаем последний deliverable
      const account = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        provider
      )
      
      if (!account.deliverables || account.deliverables.length === 0) {
        throw new Error('No deliverables found')
      }

      const latestIndex = account.deliverables.length - 1
      const deliverable = account.deliverables[latestIndex]

      // Скачиваем модель если указан путь
      if (downloadPath) {
        // TODO: Implement download from 0G Storage using deliverable.modelRootHash
        console.log('Model download not implemented yet')
      }

      // Подтверждаем получение
      const tx = await this.broker.fineTuning.acknowledgeDeliverable(
        provider,
        BigInt(latestIndex)
      )
      await tx.wait()

      return deliverable.modelRootHash
    } catch (error) {
      console.error('Error acknowledging model:', error)
      throw error
    }
  }

  /**
   * Расшифровка модели
   * Эквивалент: 0g-compute-cli decrypt-model
   */
  async decryptModel(provider: string, encryptedModelPath: string, outputPath: string): Promise<void> {
    try {
      // 1. Получаем зашифрованный ключ из контракта
      const account = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        provider
      )

      // 2. Находим ключ для последней модели
      const latestDeliverable = account.deliverables[account.deliverables.length - 1]
      if (!latestDeliverable.encryptedKey) {
        throw new Error('Encrypted key not found. Provider may not have uploaded it yet.')
      }

      // 3. Расшифровываем ключ используя приватный ключ пользователя
      // TODO: Implement actual decryption
      console.log('Model decryption not implemented yet')
      
    } catch (error) {
      console.error('Error decrypting model:', error)
      throw error
    }
  }

  // Вспомогательные методы

  private async verifyProvider(provider: string): Promise<ProviderInfo> {
    try {
      const service = await this.broker.fineTuning.getService(provider)
      return {
        address: provider,
        available: true,
        pricePerByte: service.pricePerByte || '1'
      }
    } catch (error) {
      throw new Error('Provider verification failed')
    }
  }

  private getDefaultTrainingConfig(model: string): any {
    // Дефолтная конфигурация согласно документации
    return {
      num_train_epochs: 3,
      per_device_train_batch_size: 16,
      per_device_eval_batch_size: 16,
      warmup_steps: 500,
      weight_decay: 0.01,
      logging_dir: "./logs",
      logging_steps: 100,
      evaluation_strategy: "no",
      save_strategy: "epoch",
      save_steps: 1,
      save_total_limit: 1,
      eval_steps: 50,
      load_best_model_at_end: false,
      metric_for_best_model: "accuracy",
      greater_is_better: true,
      report_to: ["none"]
    }
  }

  private extractTaskIdFromReceipt(receipt: any): string {
    // Извлекаем Task ID из событий транзакции
    if (receipt.logs && receipt.logs.length > 0) {
      // TODO: Parse actual event logs
      return `task-${Date.now()}`
    }
    return `task-${Date.now()}`
  }
}