import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs/promises'
import path from 'path'
import { uploadToStorage, downloadFromStorage } from '../lib/storage/client-server'
import { resolveAvatarSrc } from '../components/agents/AgentAvatar'

const testDir = path.join(process.cwd(), 'data', 'metadata')

beforeEach(async () => {
  process.env.OG_STORAGE_PRIVATE_KEY = "0x" + "1".repeat(64)
  await fs.mkdir(testDir, { recursive: true })
})

describe('storage fallbacks', () => {
  it('uploadToStorage fallback writes local file', async () => {
    vi.mock('@0glabs/0g-ts-sdk', async () => {
      const mod = await vi.importActual<any>('@0glabs/0g-ts-sdk')
      return { ...mod, Indexer: class { async upload(){ throw new Error('fail') } } }
    })
    const data = JSON.stringify({ a: 1 })
    const res = await uploadToStorage(data, 't.json')
    expect(res.rootHash.startsWith('local://')).toBe(true)
    const hash = res.rootHash.replace('local://','')
    const file = path.join(testDir, `${hash}.json`)
    const content = await fs.readFile(file, 'utf-8')
    expect(content).toBe(data)
  })

  it('downloadFromStorage fallback reads local file', async () => {
    const hash = 'testhash'
    const filePath = path.join(testDir, `${hash}.json`)
    await fs.writeFile(filePath, '{"x":1}')
    const blob = await downloadFromStorage(`local://${hash}`)
    expect(blob instanceof Blob).toBe(true)
    expect(blob.type).toBe('application/json')
    const text = await blob.text()
    expect(text).toBe('{"x":1}')
  })
})

describe('avatar preview', () => {
  const seed = 'test'
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`

  it('allows png, jpeg and webp', () => {
    expect(resolveAvatarSrc('data:image/png;base64,AA', seed)).toBe('data:image/png;base64,AA')
    expect(resolveAvatarSrc('data:image/jpeg;base64,AA', seed)).toBe('data:image/jpeg;base64,AA')
    expect(resolveAvatarSrc('data:image/webp;base64,AA', seed)).toBe('data:image/webp;base64,AA')
  })

  it('falls back for gif and svg', () => {
    expect(resolveAvatarSrc('data:image/gif;base64,AA', seed)).toBe(fallback)
    expect(resolveAvatarSrc('data:image/svg+xml;base64,AA', seed)).toBe(fallback)
  })
})
