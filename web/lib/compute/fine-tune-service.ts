import fs from 'fs/promises'
import path from 'path'
import { calculateTokenSize } from './utils'

const PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

const MOCK = process.env.MOCK_FINE_TUNE === '1'
const mockTasks: Record<string, number> = {}

export class FineTuneService {
  constructor(private broker: any) {}

  async createTask(params: {
    agentId: string
    datasetRootHash: string
    baseModel: string
    steps: number
    learningRate: number
    dataSize?: number
  }): Promise<string> {
    const dataSize = params.dataSize ?? calculateTokenSize(params.datasetRootHash)
    const configPath = await this.saveConfig({ steps: params.steps, learning_rate: params.learningRate })

    if (MOCK) {
      const id = `task-${Date.now()}`
      mockTasks[id] = 0
      return id
    }

    if (this.broker.tasks?.createTask) {
      return await this.broker.tasks.createTask(
        PROVIDER,
        params.baseModel,
        dataSize,
        params.datasetRootHash,
        configPath
      )
    }

    if (this.broker.inference?.getRequestHeaders) {
      const headers = await this.broker.inference.getRequestHeaders(PROVIDER, '')
      const resp = await fetch(`${PROVIDER}/fine-tune/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          model: params.baseModel,
          dataset: params.datasetRootHash,
          dataSize,
          trainingPath: configPath
        })
      })
      const json: any = await resp.json().catch(() => ({}))
      if (resp.ok && json.taskId) return json.taskId
    }

    throw new Error('fine-tune provider rejected request')
  }

  async getStatus(taskId: string) {
    if (MOCK) {
      const count = ++mockTasks[taskId]
      let progress = 'Training'
      if (count >= 5) progress = 'Finished'
      else if (count >= 3) progress = 'Delivered'
      return progress === 'Finished'
        ? { progress, modelRootHash: '0xmockmodel' }
        : { progress }
    }
    if (this.broker.tasks?.getTaskStatus) {
      return await this.broker.tasks.getTaskStatus(PROVIDER, taskId)
    }
    return await this.broker.fineTuning.getTask(PROVIDER, taskId)
  }

  async acknowledge(taskId: string) {
    if (MOCK) {
      return 'mock.bin'
    }
    const dir = path.join(process.cwd(), 'data', 'models')
    await fs.mkdir(dir, { recursive: true })
    const out = path.join(dir, `${taskId}.bin`)
    if (this.broker.tasks?.acknowledgeModel) {
      await this.broker.tasks.acknowledgeModel(PROVIDER, out)
    } else {
      await this.broker.fineTuning.acknowledgeModel(PROVIDER, out)
    }
    return out
  }

  private async saveConfig(config: any) {
    const dir = path.join(process.cwd(), 'data', 'configs')
    await fs.mkdir(dir, { recursive: true })
    const file = path.join(dir, `train-${Date.now()}.json`)
    await fs.writeFile(file, JSON.stringify(config))
    return file
  }
}
