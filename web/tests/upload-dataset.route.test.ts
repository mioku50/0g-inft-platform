import { describe, it, expect, vi } from 'vitest'
vi.mock('../lib/storage/client-server', () => ({
  uploadToStorage: vi.fn(async () => ({ rootHash: '0xabc', size: 1 })),
  hashAndExists: vi.fn(async () => ({ root: '0xabc', exists: false }))
}))

import { uploadDataset } from '../app/agents/[id]/fine-tune/actions'

describe('upload dataset api', () => {
  it('returns root and size', async () => {
    const file = new File([Buffer.from('x')], 'd.jsonl')
    const form = new FormData()
    form.append('file', file)
    const res = await uploadDataset(form)
    expect(res).toEqual({ rootHash: '0xabc', size: 1, uploaded: true })
  })
})
