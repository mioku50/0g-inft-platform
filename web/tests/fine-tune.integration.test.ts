import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'
config({ path: '.env.test' })
import fs from 'fs/promises'
import { getBroker } from '../lib/compute/broker'
import { FineTuneService } from '../lib/compute/fine-tune-service'
import { uploadToStorage } from '../lib/storage/client-server'

const dataset = Buffer.from('{"prompt":"hi","completion":"there"}\n')

describe('fine tune integration', () => {
  it('runs end to end', async () => {
    if (!process.env.OG_COMPUTE_PRIVATE_KEY) {
      console.warn('OG_COMPUTE_PRIVATE_KEY not set; skipping integration test')
      return
    }
    const up = await uploadToStorage(dataset, 'd.jsonl')
    const broker = await getBroker()
    const service = new FineTuneService(broker)

    const taskId = await service.createTask({
      agentId: 'it',
      datasetRootHash: up.rootHash,
      baseModel: 'llama',
      steps: 1,
      learningRate: 0.1,
      dataSize: dataset.length
    })

    expect(taskId).toBeTruthy()
    for (let i = 0; i < 30; i++) {
      const status: any = await service.getStatus(taskId)
      if (status.progress === 'Finished') {
        const path = await service.acknowledge(taskId)
        const stat = await fs.stat(path)
        expect(stat.size).toBeGreaterThan(0)
        return
      }
      if (status.progress === 'Failed') {
        throw new Error('task failed')
      }
      await new Promise(r => setTimeout(r, 30000))
    }
    throw new Error('timeout')
  }, 15 * 60 * 1000)
})
