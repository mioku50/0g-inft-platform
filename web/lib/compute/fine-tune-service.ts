// lib/compute/fine-tune-service.ts
import { getBroker, getFineTuneProvider } from './broker'
import { toWei, fromWei } from '@/lib/constants'

// Маппинг моделей согласно официальной документации
const MODEL_MAPPING = {
  'llama-3.3-70b': '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7',
  'deepseek-r1-70b': '0x2084fdd904c9a3317dde98147d4e7778a40e076b5b0eb469f7a8f27ae5b13e7f'
}

// Official task schema matching the SDK
export interface FineTuningTaskRequest {
  userAddress: string
  preTrainedModelHash: string
  datasetHash: string
  trainingParams: string
  fee: string
  nonce: string
  signature: string
  wait?: boolean
}

export interface FineTuningTaskResponse {
  id: string
  progress: string
  deliverIndex?: number
  latestDeliverableIndex?: number
  acknowledged: boolean
  modelRootHash?: string
  createdAt?: string
  updatedAt?: string
  deliverTime?: number
}

export class FineTuneService {
  constructor(private broker: any) {}

  /**
   * Создание задачи Fine-tuning через официальный 0G Provider
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
        num_train_epochs: Math.ceil(params.steps / 100),
        per_device_train_batch_size: 4,
        per_device_eval_batch_size: 4,
        learning_rate: params.learningRate,
        warmup_steps: 50,
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

      // 3. Получение nonce из главного Ledger account
      let nonce = '0'
      try {
        const account = await this.broker.fineTuning.getAccount(
          this.broker.signer.address,
          getFineTuneProvider()
        )
        nonce = account.nonce?.toString() || '0'
      } catch (error) {
        // Fine-Tune sub-account не существует, используем nonce = 0
        console.log('Fine-Tune sub-account not found, using nonce = 0')
      }

      // 4. Подготовка данных для запроса согласно официальной схеме
      const taskRequest: FineTuningTaskRequest = {
        userAddress: this.broker.signer.address,
        preTrainedModelHash,
        datasetHash: params.datasetRootHash,
        trainingParams: JSON.stringify(trainingParams),
        fee: toWei('0.001').toString(), // Базовая fee, может быть рассчитана динамически
        nonce: nonce,
        signature: '0x', // Подпись создается автоматически через SDK
        wait: false
      }

      // 5. Получение информации о провайдере
      const { endpoint } = await this.broker.inference.getServiceMetadata(getFineTuneProvider())
      
      // 6. Создание заголовков для аутентификации
      const headers = await this.broker.inference.getRequestHeaders(
        getFineTuneProvider(),
        JSON.stringify(taskRequest)
      )

      // 7. Отправка запроса на создание задачи
      const response = await fetch(`${endpoint}/v1/user/${taskRequest.userAddress}/task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(taskRequest)
      })

      if (response.status === 204) {
        const list = await fetch(`${endpoint}/v1/user/${taskRequest.userAddress}/task?latest=1`).then(r => r.json()).catch(() => [])
        return list?.[0]?.id ?? ''
      }

      const result = await response.json().catch(() => null)
      return result?.id || result?.taskId || ''

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
      const { endpoint } = await this.broker.inference.getServiceMetadata(getFineTuneProvider())
      
      // Получение статуса задачи
      const response = await fetch(`${endpoint}/v1/user/${this.broker.signer.address}/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to get task status: ${response.status}`)
      }

      const taskData = await response.json()
      
      // Преобразование статуса согласно официальной схеме
      const status: FineTuningTaskResponse = {
        id: taskData.id,
        progress: this.mapProgressStatus(taskData.progress || 'Init'),
        deliverIndex: taskData.deliverIndex,
        latestDeliverableIndex: undefined,
        acknowledged: false,
        createdAt: taskData.createdAt,
        updatedAt: taskData.updatedAt,
        deliverTime: taskData.deliverTime
      }

      // Если задача завершена, получаем hash модели
      if (this.isTaskCompleted(status.progress)) {
        try {
          const account = await this.broker.fineTuning.getAccount(
            this.broker.signer.address,
            getFineTuneProvider()
          )

          if (account && account.deliverables && account.deliverables.length > 0) {
            const idx = account.deliverables.length - 1
            const deliverable = account.deliverables[idx]
            status.latestDeliverableIndex = idx
            status.modelRootHash = deliverable.modelRootHash
            status.acknowledged = deliverable.acknowledged
            status.progress = deliverable.acknowledged ? 'Finished' : 'Delivered'
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
      const acc = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        getFineTuneProvider()
      )
      
      if (!acc.deliverables || acc.deliverables.length === 0) {
        throw new Error('No deliverables found to acknowledge')
      }

      const idx = BigInt(acc.deliverables.length - 1)
      await this.broker.fineTuning.acknowledgeDeliverable(
        getFineTuneProvider(),
        idx
      )

      return `Model acknowledged for task ${taskId}`
    } catch (error) {
      console.error('Error acknowledging model:', error)
      throw error
    }
  }

  /**
   * Инициализация аккаунта для Fine-tuning
   */
  async initializeAccount(): Promise<void> {
    try {
      // Проверяем существование аккаунта
      const accountExists = await this.broker.fineTuning.accountExists(
        this.broker.signer.address,
        getFineTuneProvider()
      )

      if (!accountExists) {
        console.log('Creating fine-tuning account...')
        
        // Создаем аккаунт с начальным балансом
        await this.broker.fineTuning.addAccount(
          this.broker.signer.address,
          getFineTuneProvider(),
          'INFT Platform User',
          { value: toWei('0.01') }
        )
        
        console.log('Fine-tuning account created')
      }

      // Подтверждаем провайдера
      await this.broker.fineTuning.acknowledgeProviderSigner(
        getFineTuneProvider(),
        getFineTuneProvider()
      )

    } catch (error) {
      console.error('Error initializing fine-tuning account:', error)
      throw error
    }
  }

  /**
   * Получение баланса аккаунта
   */
  async getAccountBalance(): Promise<string> {
    try {
      const account = await this.broker.fineTuning.getAccount(
        this.broker.signer.address,
        getFineTuneProvider()
      )
      
      if (account && account.balance !== undefined) {
        return fromWei(account.balance)
      }
      
      return '0'
    } catch (error) {
      console.error('Error getting account balance:', error)
      return '0'
    }
  }

  /**
   * Пополнение баланса аккаунта
   */
  async depositFunds(amount: string) {
    try {
      const tx = await this.broker.fineTuning.depositFund(
        this.broker.signer.address,
        getFineTuneProvider(),
        0n,
        { value: toWei(amount) }
      )
      return tx
    } catch (error) {
      console.error('Error depositing funds:', error)
      throw error
    }
  }

  /**
   * Преобразование статусов провайдера согласно официальной документации
   */
  private mapProgressStatus(providerStatus: string): string {
    // Официальные статусы из swagger и SDK
    const statusMap: Record<string, string> = {
      'Init': 'Init',
      'Pending': 'SettingUp', 
      'Processing': 'Training',
      'Training': 'Training',
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
   * Проверка завершения задачи
   */
  private isTaskCompleted(progress: string): boolean {
    return ['Delivered', 'Finished', 'Failed'].includes(progress)
  }

  /**
   * Проверка успешного завершения задачи
   */
  private isTaskSuccessful(progress: string): boolean {
    return ['Delivered', 'Finished'].includes(progress)
  }

  /**
   * Проверка неудачного завершения задачи
   */
  private isTaskFailed(progress: string): boolean {
    return progress === 'Failed'
  }

  /**
   * Проверка выполнения задачи
   */
  private isTaskInProgress(progress: string): boolean {
    return ['Init', 'SettingUp', 'Training', 'Delivering'].includes(progress)
  }
}