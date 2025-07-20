import 'dotenv/config'
import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk'
import { ethers } from 'ethers'
import * as fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface UploadResult {
  rootHash: string
  txHash?: string
  size?: number
  segments?: number
}

const METADATA_DIR = path.join(process.cwd(), 'data', 'metadata')

async function saveLocal(content: string): Promise<string> {
  await fs.mkdir(METADATA_DIR, { recursive: true })
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  const filePath = path.join(METADATA_DIR, `${hash}.json`)
  await fs.writeFile(filePath, content, 'utf-8')
  return `local://${hash}`
}

export async function uploadToStorage(file: File | Buffer | string, fileName = 'metadata.json'): Promise<UploadResult> {
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
  if (!privateKey) throw new Error('OG_STORAGE_PRIVATE_KEY not configured')
  const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  const provider = new ethers.JsonRpcProvider(evmRpc)
  const wallet = new ethers.Wallet(privateKey, provider)

  const tempDir = path.join(process.cwd(), 'tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `${Date.now()}-${fileName}`)
  const data = typeof file === 'string' ? Buffer.from(file) : Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer())
  await fs.writeFile(tempFile, data)

  const zgFile = await ZgFile.fromFilePath(tempFile)
  const [tree] = await zgFile.merkleTree()
  const indexer = new Indexer(indexerRpc)

  let lastErr: any
  for (let i = 0; i < 3; i++) {
    try {
      const feeData = await provider.getFeeData()
      const gasPrice = (feeData.gasPrice || ethers.parseUnits('1', 'gwei')) * BigInt(2 ** i)
      const [tx, err] = await indexer.upload(zgFile, evmRpc, wallet, undefined, undefined, { gasPrice })
      if (!err) {
        await fs.unlink(tempFile).catch(() => {})
        const size = zgFile.size()
        await zgFile.close()
        return { rootHash: tree!.rootHash() as string, txHash: tx, size, segments: Math.ceil(size / 256 / 1024) }
      }
      lastErr = err
    } catch (e) {
      lastErr = e
    }
  }

  await fs.unlink(tempFile).catch(() => {})
  await zgFile.close()
  const content = typeof file === 'string' ? file : data.toString()
  const localHash = await saveLocal(content)
  return { rootHash: localHash }
}

export async function downloadFromStorage(rootHash: string): Promise<Blob> {
  if (rootHash.startsWith('local://')) {
    const hash = rootHash.replace('local://', '')
    const file = path.join(METADATA_DIR, `${hash}.json`)
    const data = await fs.readFile(file, 'utf-8')
    return new Blob([data], { type: 'application/json' })
  }

  const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  const tempDir = path.join(process.cwd(), 'tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `d-${Date.now()}.tmp`)
  try {
    const indexer = new Indexer(indexerRpc)
    const err = await indexer.download(rootHash, tempFile, false)
    if (err) throw err
    const content = await fs.readFile(tempFile, 'utf-8')
    await fs.unlink(tempFile).catch(() => {})
    let type = 'application/json'
    try {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object' && parsed.contentType) {
        type = parsed.contentType
      }
    } catch {}
    return new Blob([content], { type })
  } catch (e: any) {
    if (e?.code === -32000) {
      const localPath = path.join(METADATA_DIR, `${rootHash}.json`)
      try {
        const data = await fs.readFile(localPath, 'utf-8')
        return new Blob([data], { type: 'application/json' })
      } catch {}
    }
    const fallback = JSON.stringify({ name: 'Unknown Agent', description: 'Metadata not available', model: 'Unknown', error: 'metadata_not_found' })
    return new Blob([fallback], { type: 'application/json' })
  }
}
