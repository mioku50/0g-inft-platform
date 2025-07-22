import { describe, it, expect, vi } from 'vitest'

import { NextRequest } from 'next/server'

vi.mock('../lib/compute/broker', () => ({
  getBroker: vi.fn(async () => ({}))
}))

const createTaskMock = vi.fn(async () => 'X')
vi.mock('../lib/compute/fine-tune-service', () => ({
  FineTuneService: vi.fn().mockImplementation(() => ({
    createTask: createTaskMock
  }))
}))

vi.mock('../lib/storage/client-server', () => ({
  uploadToStorage: vi.fn(async () => ({ rootHash: '0xabc' })),
  hashAndExists: vi.fn(async () => ({ root: '0xabc', exists: false }))
}))

import { POST } from '../app/api/compute/fine-tune/route'
import { POST as uploadDataset } from '../app/api/storage/upload-dataset/route'

describe('fine tune api', () => {
  it('returns taskId', async () => {
    const req = new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        agentId: '1',
        datasetRoot: 'hash',
        baseModel: 'model',
        steps: 1,
        learningRate: 0.1
      })
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ success: true, taskId: 'X' })
    expect(createTaskMock).toHaveBeenCalled()
  })

  it('upload dataset returns root and size', async () => {
    const file = new File([Buffer.from('x')], 'd.jsonl')
    const form = new FormData()
    form.append('file', file)

    const req = new NextRequest('http://localhost', { method: 'POST', body: form })
    const res = await uploadDataset(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ root: '0xabc', size: file.size, uploaded: true })
  })
})
