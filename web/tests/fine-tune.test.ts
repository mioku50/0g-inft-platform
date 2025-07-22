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

import { POST } from '../app/api/compute/fine-tune/route'

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
})
