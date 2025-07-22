// web/lib/compute/fine-tune-service.ts
import { ethers } from 'ethers'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export class FineTuneService {
  private broker: any
  
  constructor(broker: any) {
    this.broker = broker
  }
  
  async createTask(params: {
    model: string
    datasetRootHash: string
    configPath: any
    dataSize: number
  }) {
    try {
      console.log('Creating fine-tune task with params:', params)
      
      // 1. Проверяем что dataset не локальный
      if (params.datasetRootHash.startsWith('local://')) {
        throw new Error('Dataset must be uploaded to 0G Storage first. Local datasets are not supported for fine-tuning.')
      }
      
      // 2. Проверяем баланс через правильный метод
      try {
        const ledger = await this.broker.ledger.getLedger()
        console.log('Current ledger:', ledger)
        
        if (!ledger || ledger.balance === '0') {
          console.log('Creating new ledger...')
          await this.broker.ledger.addLedger(0.1)
        }
      } catch (err: any) {
        console.log('Ledger check error:', err.message)
        if (err.message.includes('Ledger already exists')) {
          console.log('Ledger exists, continuing...')
        }
      }
      
      // 3. Создаем конфигурационный файл
      const configFile = await this.saveTrainingConfig(params.configPath)
      console.log('Config saved to:', configFile)
      
      // 4. Проверяем установлен ли 0g-compute-cli
      try {
        await execAsync('0g-compute-cli --version')
      } catch (e) {
        throw new Error('0g-compute-cli not installed. Please install it globally: npm install -g @0glabs/0g-serving-broker')
      }
      
      // 5. Устанавливаем переменные окружения
      const env = {
        ...process.env,
        RPC_ENDPOINT: process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai',
        ZG_PRIVATE_KEY: process.env.OG_COMPUTE_PRIVATE_KEY
      }
      
      // 6. Список официальных провайдеров fine-tuning (из документации)
      const FINETUNE_PROVIDERS = [
        '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // Официальный провайдер
        // Добавьте других провайдеров если найдете
      ]
      
      // 7. Проверяем доступных провайдеров
      console.log('Checking available fine-tuning providers...')
      const { stdout: providersList } = await execAsync('0g-compute-cli list-providers', { env })
      console.log('Available providers:', providersList)
      
      // 8. Создаем задачу через CLI
      const command = `0g-compute-cli create-task \
        --provider ${FINETUNE_PROVIDERS[0]} \
        --model ${params.model} \
        --dataset ${params.datasetRootHash} \
        --config-path ${configFile} \
        --data-size ${params.dataSize}`
      
      console.log('Executing command:', command)
      
      const { stdout, stderr } = await execAsync(command, { env })
      
      if (stderr) {
        console.error('CLI stderr:', stderr)
      }
      
      console.log('CLI output:', stdout)
      
      // Извлекаем task ID из вывода
      const taskIdMatch = stdout.match(/Task ID: ([a-f0-9-]+)/i) || 
                         stdout.match(/Created Task ID: ([a-f0-9-]+)/i)
      
      if (taskIdMatch) {
        const taskId = taskIdMatch[1]
        console.log('Task created successfully:', taskId)
        
        // Сохраняем информацию о задаче
        await this.saveTaskInfo(taskId, params)
        
        return taskId
      }
      
      throw new Error('Failed to extract task ID from CLI output: ' + stdout)
      
    } catch (error: any) {
      console.error('Error creating fine-tune task:', error)
      throw new Error(`Failed to create fine-tune task: ${error.message}`)
    }
  }
  
  async getTaskStatus(taskId: string) {
    try {
      const env = {
        ...process.env,
        RPC_ENDPOINT: process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai',
        ZG_PRIVATE_KEY: process.env.OG_COMPUTE_PRIVATE_KEY
      }
      
      const command = `0g-compute-cli get-task --provider 0xf07240Efa67755B5311bc75784a061eDB47165Dd --task ${taskId}`
      const { stdout, stderr } = await execAsync(command, { env })
      
      if (stderr) {
        console.error('CLI stderr:', stderr)
      }
      
      console.log('Task status output:', stdout)
      
      // Парсим вывод CLI
      const progressMatch = stdout.match(/Progress\s*│\s*(\w+)/i)
      const feeMatch = stdout.match(/Fee \(neuron\)\s*│\s*(\d+)/i)
      const modelHashMatch = stdout.match(/Fine-tuned Model Hash\s*│\s*(0x[a-f0-9]+)/i)
      
      const progress = progressMatch ? progressMatch[1] : 'Unknown'
      
      return {
        taskId,
        progress,
        status: progress,
        fee: feeMatch ? feeMatch[1] : '0',
        modelRootHash: modelHashMatch ? modelHashMatch[1] : null,
        logs: stdout
      }
      
    } catch (error: any) {
      console.error('Error getting task status:', error)
      return {
        taskId,
        progress: 'Error',
        status: 'Error',
        error: error.message
      }
    }
  }
  
  async acknowledgeModel(taskId: string) {
    try {
      const env = {
        ...process.env,
        RPC_ENDPOINT: process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai',
        ZG_PRIVATE_KEY: process.env.OG_COMPUTE_PRIVATE_KEY
      }
      
      // Создаем временную директорию для модели
      const modelPath = path.join(process.cwd(), 'data', 'models', `${taskId}.zip`)
      await fs.mkdir(path.dirname(modelPath), { recursive: true })
      
      const command = `0g-compute-cli acknowledge-model --provider 0xf07240Efa67755B5311bc75784a061eDB47165Dd --data-path ${modelPath}`
      const { stdout, stderr } = await execAsync(command, { env })
      
      if (stderr) {
        console.error('CLI stderr:', stderr)
      }
      
      console.log('Acknowledge output:', stdout)
      
      return {
        success: true,
        acknowledged: true,
        modelPath
      }
      
    } catch (error: any) {
      console.error('Error acknowledging model:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  private async saveTrainingConfig(config: any): Promise<string> {
    const configDir = path.join(process.cwd(), 'data', 'configs')
    await fs.mkdir(configDir, { recursive: true })
    
    const configFile = path.join(configDir, `config-${Date.now()}.json`)
    
    // Формат конфигурации для 0G
    const formattedConfig = {
      model_type: config.base_model,
      training: {
        batch_size: config.batch_size,
        learning_rate: config.learning_rate,
        num_train_epochs: Math.ceil(config.training_steps / 1000),
        warmup_steps: config.warmup_steps,
        save_steps: config.save_steps,
        logging_steps: config.logging_steps,
        evaluation_strategy: config.evaluation_strategy,
        eval_steps: config.eval_steps,
        max_seq_length: config.max_seq_length,
        gradient_accumulation_steps: config.gradient_accumulation_steps
      }
    }
    
    await fs.writeFile(configFile, JSON.stringify(formattedConfig, null, 2))
    return configFile
  }
  
  private async saveTaskInfo(taskId: string, params: any) {
    const tasksFile = path.join(process.cwd(), 'data', 'fine-tune-tasks.json')
    
    let tasks = {}
    try {
      const content = await fs.readFile(tasksFile, 'utf-8')
      tasks = JSON.parse(content)
    } catch (e) {}
    
    tasks[taskId] = {
      ...params,
      createdAt: new Date().toISOString(),
      status: 'Init'
    }
    
    await fs.writeFile(tasksFile, JSON.stringify(tasks, null, 2))
  }
}