// web/lib/storage/client-server.ts
import { ZgFile, Indexer, getFlowContract } from '@0glabs/0g-ts-sdk'
import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'
import { writeFile, unlink } from 'fs/promises'

interface UploadResult {
  rootHash: string
  txHash: string
  size: number
  segments: number
}

export async function uploadToStorage(
  file: File | Buffer,
  fileName?: string
): Promise<UploadResult> {
  console.log('=== Storage Upload Debug ===')
  
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_STORAGE_PRIVATE_KEY not configured')
  }

  // Network configuration
  const flowAddress = process.env.NEXT_PUBLIC_0G_FLOW_ADDRESS || '0xbD75117F80b4E22698D0Cd7612d92BDb8eaff628'
  const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'

  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    hasStorageKey: !!privateKey,
    keyLength: privateKey.length,
    keyPrefix: privateKey.substring(0, 6) + '...',
    flowAddress,
    storageRpc: indexerRpc,
    l1Rpc: evmRpc
  })

  // Create temporary file path
  const tempDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  const tempFilePath = path.join(tempDir, `upload-${Date.now()}-${fileName || 'file'}`)
  
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(evmRpc)
    const wallet = new ethers.Wallet(privateKey, provider)
    console.log('Wallet address:', wallet.address)

    // Check balance
    const balance = await provider.getBalance(wallet.address)
    console.log('Wallet balance:', ethers.formatEther(balance), 'ETH')

    if (balance === 0n) {
      throw new Error('Wallet has no balance. Please fund it with testnet tokens.')
    }

    // Write buffer to temporary file
    if (Buffer.isBuffer(file)) {
      console.log('Writing buffer to temp file, size:', file.length)
      await writeFile(tempFilePath, file)
    } else {
      console.log('Writing File object to temp file')
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await writeFile(tempFilePath, buffer)
    }

    // Create ZgFile from file path
    console.log('Creating ZgFile from path:', tempFilePath)
    const zgFile = await ZgFile.fromFilePath(tempFilePath)
    
    // Get merkle tree
    const [tree, treeErr] = await zgFile.merkleTree()
    if (treeErr) {
      console.error('Merkle tree error:', treeErr)
      throw new Error(`Failed to create merkle tree: ${treeErr}`)
    }
    console.log('File root hash:', tree.rootHash())

    // Create indexer client
    const indexer = new Indexer(indexerRpc)
    console.log('Indexer initialized')

    // Upload to storage nodes
    console.log('Uploading to storage nodes...')
    const [uploadTx, uploadErr] = await indexer.upload(
      zgFile,
      evmRpc,
      wallet
    )

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr)
      throw new Error(`Failed to upload to storage: ${uploadErr}`)
    }

    console.log('Upload complete:', uploadTx)
    
    // Get file size before closing
    const fileSize = zgFile.size()
    
    // Close file
    await zgFile.close()

    // Return result
    return {
      rootHash: tree.rootHash(),
      txHash: uploadTx,
      size: fileSize,
      segments: Math.ceil(fileSize / (1024 * 1024)) // Calculate segments based on 1MB chunks
    }
  } catch (error) {
    console.error('0G Storage upload error:', error)
    throw new StorageError(
      `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    )
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFilePath)) {
        await unlink(tempFilePath)
        console.log('Temp file cleaned up')
      }
    } catch (err) {
      console.error('Failed to clean up temp file:', err)
    }
  }
}

export async function downloadFromStorage(rootHash: string): Promise<Buffer> {
  try {
    const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
    const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    
    console.log('=== Storage Download Debug ===')
    console.log('Downloading file with root hash:', rootHash)
    console.log('Indexer RPC:', indexerRpc)
    
    const indexer = new Indexer(indexerRpc)
    
    // Create temp file for download
    const tempDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const outputPath = path.join(tempDir, `download-${Date.now()}.tmp`)
    
    console.log('Downloading to temp path:', outputPath)
    
    // Download file
    const err = await indexer.download(rootHash, outputPath, false) // false = without proof
    
    if (err !== null) {
      console.error('Download error:', err)
      throw new Error(`Download failed: ${err}`)
    }
    
    console.log('Download complete, reading file...')
    
    // Read file into buffer
    const buffer = await fs.promises.readFile(outputPath)
    console.log('File read successfully, size:', buffer.length)
    
    // Clean up temp file
    try {
      await unlink(outputPath)
      console.log('Temp download file cleaned up')
    } catch (cleanupErr) {
      console.error('Failed to clean up download file:', cleanupErr)
    }
    
    return buffer
  } catch (error) {
    console.error('0G Storage download error:', error)
    throw new StorageError(
      `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error
    )
  }
}

// Helper function to verify if content exists
export async function verifyContent(rootHash: string): Promise<boolean> {
  try {
    const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
    const indexer = new Indexer(indexerRpc)
    
    // Try to get file info
    const info = await indexer.getFileInfo(rootHash)
    return info !== null
  } catch (error) {
    console.error('Error verifying content:', error)
    return false
  }
}

// Helper function to get storage URL for a root hash
export function getStorageUrl(rootHash: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  return `${baseUrl}/${rootHash}`
}

export class StorageError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'StorageError'
  }
}