import fs from 'fs/promises'
import path from 'path'
import { calculateTokenSize } from './utils'

const PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'

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
    const taskId = await this.broker.fineTuning.createTask(
      PROVIDER,
      params.baseModel,
      dataSize,
      params.datasetRootHash,
      configPath
    )
    return taskId
  }

  async getStatus(taskId: string) {
    return await this.broker.fineTuning.getTask(PROVIDER, taskId)
  }

  async acknowledge(taskId: string) {
    const dir = path.join(process.cwd(), 'data', 'models')
    await fs.mkdir(dir, { recursive: true })
    const out = path.join(dir, `${taskId}.bin`)
    await this.broker.fineTuning.acknowledgeModel(PROVIDER, out)
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
