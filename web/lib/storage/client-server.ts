// web/lib/storage/client-server.ts
import { ZgFile, Indexer, getFlowContract } from '@0glabs/0g-ts-sdk'
import { ethers } from 'ethers'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const RPC_URL = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const INDEXER_RPC = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
const PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY!
const FLOW_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_0G_FLOW_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628'

export async function uploadToStorage(content: string | Buffer, filename?: string): Promise<{ rootHash: string; txHash: string }> {
  console.log('=== Storage Upload Debug ===')
  console.log('Content size:', typeof content === 'string' ? content.length : content.length)
  console.log('Filename:', filename || 'metadata.json')
  
  let file: ZgFile
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-'))
  const tempPath = path.join(tempDir, filename || 'metadata.json')
  
  try {
    await fs.writeFile(tempPath, content)
    console.log('Temp file created:', tempPath)
    
    file = await ZgFile.fromFilePath(tempPath)
    const [tree, merkleError] = await file.merkleTree()
    
    if (merkleError) {
      console.error('Merkle tree error:', merkleError)
      throw merkleError
    }
    
    console.log('File root hash:', tree!.rootHash())
    
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const signer = new ethers.Wallet(PRIVATE_KEY, provider)
    
    const balance = await provider.getBalance(signer.address)
    console.log('Wallet balance:', ethers.formatEther(balance), 'OG')
    
    if (balance < ethers.parseEther('0.01')) {
      throw new Error('Insufficient balance for upload. Need at least 0.01 OG')
    }
    
    const indexer = new Indexer(INDEXER_RPC)
    
    console.log('Starting upload...')
    const [uploadTx, uploadError] = await indexer.upload(file, RPC_URL, signer)
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }
    
    console.log('Upload transaction:', uploadTx)
    
    if (uploadTx) {
      console.log('Waiting for transaction confirmation...')
      const receipt = await provider.waitForTransactionReceipt(uploadTx, 3)
      console.log('Transaction confirmed:', receipt?.status === 1 ? 'Success' : 'Failed')
    }
    
    // Ждем синхронизации
    console.log('Waiting for storage network synchronization...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    const rootHash = tree!.rootHash()
    
    return {
      rootHash: rootHash,
      txHash: uploadTx || '0x0'
    }
    
  } catch (error) {
    console.error('0G Storage upload error:', error)
    throw error
  } finally {
    if (file!) {
      await file.close()
    }
    try {
      await fs.rm(tempDir, { recursive: true })
    } catch (e) {
      console.error('Failed to cleanup temp files:', e)
    }
  }
}

export async function downloadFromStorage(rootHash: string): Promise<string> {
  console.log('=== Storage Download Debug ===')
  console.log('Downloading file with root hash:', rootHash)
  
  const tempPath = path.join(os.tmpdir(), `download-${Date.now()}.tmp`)
  
  try {
    const indexer = new Indexer(INDEXER_RPC)
    
    const downloadError = await indexer.download(rootHash, tempPath, false)
    
    if (downloadError) {
      console.error('Download error:', downloadError)
      throw downloadError
    }
    
    console.log('Download successful, reading file...')
    const content = await fs.readFile(tempPath, 'utf-8')
    
    await fs.unlink(tempPath).catch(() => {})
    
    return content
  } catch (error) {
    console.error('0G Storage download error:', error)
    
    // Возвращаем дефолтные метаданные если файл не найден
    return JSON.stringify({
      name: 'Unknown Agent',
      description: 'Metadata not available',
      model: 'Unknown',
      error: 'metadata_not_found'
    })
  } finally {
    try {
      await fs.unlink(tempPath)
    } catch (e) {}
  }
}

export class StorageError extends Error {
  details: any
  
  constructor(message: string, details?: any) {
    super(message)
    this.name = 'StorageError'
    this.details = details
  }
}