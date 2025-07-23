import { getBroker } from './broker'
import fs from 'fs/promises'
import path from 'path'

// Официальный провайдер 0G для Fine-tuning
const FINE_TUNE_PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

// Маппинг моделей согласно официальной документации
const MODEL_MAPPING = {
  'llama-3.3-70b': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
  'deepseek-r1-70b': '0x2084fdd904c9a3317dde98147d4e7778a40e076b5b0eb469f7a8f27ae5b13e7f'
}

export interface FineTuningTaskRequest {
  userAddress: string
  serviceName: string
  datasetHash: string
  trainingParams: string
  preTrainedModelHash: string
  fee: string
  nonce: string
  signature: string
}

export interface FineTuningTaskResponse {
  id: string
  progress: string
  deliverIndex?: number
  deliverTime?: number
  modelRootHash?: string
}

export class FineTuneService {
  constructor(private broker: any) {}

  /**
   * Создание задачи Fine-tuning через официальный 0G Compute Provider
   */
  async createTask(params: {
    agentId: string
    datasetRootHash: string
    baseModel: string
    steps: number
    learningRate: number
    dataSize?: number
  }): Promise<string> {
    try {
      console.log('Creating fine-tuning task:', params)

      // 1. Подготовка параметров обучения
      const trainingParams = {
        num_train_epochs: Math.ceil(params.steps / 100), // Примерное преобразование
        per_device_train_batch_size: 8,
        per_device_eval_batch_size: 8,
        learning_rate: params.learningRate,
        warmup_steps: 100,
        weight_decay: 0.01,
        logging_steps: 10,
        evaluation_strategy: "no",
        save_strategy: "epoch",
        save_total_limit: 1,
        report_to: ["none"]
      }

      // 2. Получение hash модели
      const preTrainedModelHash = MODEL_MAPPING[params.baseModel as keyof typeof MODEL_MAPPING] 
        || MODEL_MAPPING['llama-3.3-70b']

      // 3. Подготовка данных для запроса
      const taskRequest: FineTuningTaskRequest = {
        userAddress: this.broker.signer.address,
        serviceName: 'fine-tune-service1', // Стандартное имя сервиса
        datasetHash: params.datasetRootHash,
        trainingParams: JSON.stringify(trainingParams),
        preTrainedModelHash,
        fee: '0', // Fee будет рассчитан автоматически
        nonce: Date.now().toString(),
        signature: '0x' // Подпись будет создана автоматически
      }

      // 4. Получение информации о провайдере
      const { endpoint } = await this.broker.inference.getServiceMetadata(FINE_TUNE_PROVIDER)
      
      // 5. Создание заголовков для аутентификации
      const headers = await this.broker.inference.getRequestHeaders(
        FINE_TUNE_PROVIDER,
        JSON.stringify(taskRequest)
      )

      // 6. Отправка запроса на создание задачи
      const response = await fetch(`${endpoint}/v1/user/${taskRequest.userAddress}/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(taskRequest)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Fine-tuning task creation failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Fine-tuning task created:', result)

      return result.id || result.taskId

    } catch (error) {
      console.error('Error creating fine-tuning task:', error)
      throw error
    }
  }

  /**
   * Получение статуса задачи Fine-tuning
   */
  async getStatus(taskId: string): Promise<FineTuningTaskResponse> {
    try {
      // Получение информации о провайдере
      const { endpoint } = await this.broker.inference.getServiceMetadata(FINE_TUNE_PROVIDER)
      
      // Получение статуса задачи
      const response = await fetch(`${endpoint}/v1/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.status}`)
      }

      const taskData = await response.json()
      
      // Получение прогресса выполнения
      let progressData = null
      try {
        const progressResponse = await fetch(`${endpoint}/v1/task-progress/${taskId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        if (progressResponse.ok) {
          progressData = await progressResponse.json()
        }
      } catch (error) {
        console.warn('Could not fetch progress data:', error)
      }

      // Преобразование статуса согласно вашей текущей схеме
      const status: FineTuningTaskResponse = {
        id: taskData.id,
        progress: this.mapProgressStatus(taskData.progress),
        deliverIndex: taskData.deliverIndex,
        deliverTime: taskData.deliverTime
      }

      // Если задача завершена, получаем hash модели
      if (taskData.progress === 'Delivered' || taskData.progress === 'Finished') {
        try {
          // Получение deliverable из контракта
          const account = await this.broker.fineTuning.getAccount(
            this.broker.signer.address,
            FINE_TUNE_PROVIDER
          )
          
          if (account.deliverables && account.deliverables.length > 0) {
            const deliverable = account.deliverables[account.deliverables.length - 1]
            status.modelRootHash = deliverable.modelRootHash
            status.progress = 'Finished'
          }
        } catch (error) {
          console.warn('Could not fetch deliverable:', error)
        }
      }

      return status

    } catch (error) {
      console.error('Error getting task status:', error)
      throw error
    }
  }

  /**
   * Подтверждение получения модели
   */
  async acknowledge(taskId: string): Promise<string> {
    try {
      // Подтверждение через контракт serving
      await this.broker.fineTuning.acknowledgeDeliverable(
        FINE_TUNE_PROVIDER,
        0 // Индекс deliverable
      )

      return `Model acknowledged for task ${taskId}`
    } catch (error) {
      console.error('Error acknowledging model:', error)
      throw error
    }
  }

  /**
   * Инициализация аккаунта для Fine-tuning (если не существует)
   */
  async initializeAccount(): Promise<void> {
    try {
      // Проверяем существование аккаунта
      const accountExists = await this.broker.fineTuning.accountExists(
        this.broker.signer.address,
        FINE_TUNE_PROVIDER
      )

      if (!accountExists) {
        console.log('Creating fine-tuning account...')
        
        // Создаем аккаунт с начальным балансом
        await this.broker.fineTuning.addAccount(
          this.broker.signer.address,
          FINE_TUNE_PROVIDER,
          'INFT Platform User', // additionalInfo
          { value: ethers.utils.parseEther('0.01') } // Начальный баланс
        )
        
        console.log('Fine-tuning account created')
      }

      // Подтверждаем провайдера
      await this.broker.fineTuning.acknowledgeProviderSigner(
        FINE_TUNE_PROVIDER,
        FINE_TUNE_PROVIDER // Для простоты используем тот же адрес
      )

    } catch (error) {
      console.error('Error initializing fine-tuning account:', error)
      throw error
    }
  }

  /**
   * Преобразование статусов провайдера в статусы вашей системы
   */
  private mapProgressStatus(providerStatus: string): string {
    const statusMap: Record<string, string> = {
      'Init': 'Init',
      'Pending': 'SettingUp',
      'Processing': 'Training',
      'Completed': 'Trained',
      'Delivering': 'Delivering',
      'Delivered': 'Delivered',
      'Finished': 'Finished',
      'Failed': 'Failed',
      'Error': 'Failed'
    }

    return statusMap[providerStatus] || providerStatus
  }

  /**
   * Получение баланса аккаунта
   */
  async getAccountBalance(): Promise<string> {
    try {
      const account = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        FINE_TUNE_PROVIDER
      )
      
      return ethers.utils.formatEther(account.balance)
    } catch (error) {
      console.error('Error getting account balance:', error)
      return '0'
    }
  }

  /**
   * Пополнение баланса аккаунта
   */
  async depositFunds(amount: string): Promise<void> {
    try {
      await this.broker.fineTuning.depositFund(
        this.broker.signer.address,
        FINE_TUNE_PROVIDER,
        0, // cancelRetrievingAmount
        { value: ethers.utils.parseEther(amount) }
      )
    } catch (error) {
      console.error('Error depositing funds:', error)
      throw error
    }
  }
}