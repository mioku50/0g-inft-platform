import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../lib/storage/client-server', () => ({
  uploadToStorage: vi.fn(async () => ({ rootHash: '0xabc' })),
  hashAndExists: vi.fn(async () => ({ root: '0xabc', exists: false }))
}))

import { POST } from '../app/api/storage/upload-dataset/route'

describe('upload dataset api', () => {
  it('returns root and size', async () => {
    const file = new File([Buffer.from('x')], 'd.jsonl')
    const form = new FormData()
    form.append('file', file)
    const req = new NextRequest('http://localhost', { method: 'POST', body: form })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ root: '0xabc', size: file.size, uploaded: true })
  })
})
