import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

const JOB_FILE = path.join(process.cwd(), 'data', 'fineJobs.json')

beforeEach(async () => {
  await fs.rm(JOB_FILE, { force: true })
  process.env.NEXT_PUBLIC_0G_RPC_URL = 'http://localhost'
  process.env.NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS = '0xoracle'
  process.env.OG_COMPUTE_PRIVATE_KEY = '0x' + '1'.repeat(64)
  process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS = '0xagent'
  vi.mock('../lib/storage/client-server', () => ({
    uploadToStorage: vi.fn(async () => ({ rootHash: '0xres' })),
    downloadFromStorage: vi.fn(async () => '{"ok":true}')
  }))
})

describe('fine tune flow', () => {
  it('uploads dataset and completes job', async () => {
    vi.mock('ethers', async () => {
      const mod = await vi.importActual<any>('ethers')
      class FakeContract {
        callStatic = { requestJob: async () => '0xjob' }
        async requestJob() { return { wait: async () => {} } }
        async getJobStatus() { return [2, '0xres'] }
      }
      class FakeProvider {}
      class FakeWallet { constructor() {} connect() { return this } }
      const ethersMock: any = { ...mod, Contract: FakeContract, JsonRpcProvider: FakeProvider, Wallet: FakeWallet }
      ethersMock.ethers = { ...mod.ethers, Contract: FakeContract, JsonRpcProvider: FakeProvider, Wallet: FakeWallet }
      return ethersMock
    })

    const { POST } = await import('../app/api/storage/upload-dataset/route')
    const { requestFineTune, pollJobStatus } = await import('../lib/services/fine-tune')

    const fd = new FormData()
    fd.set('file', new File(['x'], 'd.json', { type: 'application/json' }))
    const req = new (await import('next/server')).NextRequest('http://localhost', { method: 'POST', body: fd })
    const uploadRes = await POST(req)
    const uploadJson = await uploadRes.json()
    expect(uploadJson.rootHash).toBe('0xres')

    const jobId = await requestFineTune({ agentId: '1', datasetRoot: uploadJson.rootHash, baseModel: 'm', steps: 1, lr: 1 })
    expect(jobId).toBe('0xjob')
    await pollJobStatus()
    const jobs = JSON.parse(await fs.readFile(JOB_FILE, 'utf-8'))
    expect(jobs[jobId].status).toBe('COMPLETED')
  })
})
