// web/lib/storage/client-server.ts - исправленная версия
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
  file: File | Buffer | string,
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

  console.log('Network config:')
  console.log('- Flow address:', flowAddress)
  console.log('- Indexer RPC:', indexerRpc)
  console.log('- EVM RPC:', evmRpc)

  // Create temporary file path
  const tempDir = path.join(process.cwd(), 'tmp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  const tempFilePath = path.join(tempDir, `upload-${Date.now()}-${fileName || 'file'}`)
  
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(evmRpc)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    console.log('Wallet address:', wallet.address)

    // Check balance
    const balance = await provider.getBalance(wallet.address)
    console.log('Wallet balance:', ethers.formatEther(balance), 'OG')

    if (balance < ethers.parseEther('0.1')) {
      throw new Error(`Insufficient balance. Have ${ethers.formatEther(balance)} OG, need at least 0.1 OG for gas fees.`)
    }

    // Write to temporary file
    if (typeof file === 'string') {
      await writeFile(tempFilePath, file)
    } else if (Buffer.isBuffer(file)) {
      await writeFile(tempFilePath, file)
    } else {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await writeFile(tempFilePath, buffer)
    }

    const fileStats = fs.statSync(tempFilePath)
    console.log('File size:', fileStats.size, 'bytes')

    // Create ZgFile
    console.log('Creating ZgFile from path:', tempFilePath)
    const zgFile = await ZgFile.fromFilePath(tempFilePath)
    
    // Get merkle tree
    const [tree, treeErr] = await zgFile.merkleTree()
    if (treeErr) {
      throw new Error(`Failed to create merkle tree: ${treeErr}`)
    }
    console.log('File root hash:', tree.rootHash())
    
    // Create indexer client
    const indexer = new Indexer(indexerRpc)
    console.log('Indexer initialized')

    // Upload - SDK handles gas internally
    console.log('Starting upload to storage nodes...')
    
    try {
      // Simple upload call - let SDK handle gas settings
      const [uploadTx, uploadErr] = await indexer.upload(
        zgFile, 
        evmRpc, 
        wallet
      )

      if (uploadErr) {
        console.error('Storage upload error details:', uploadErr)
        
        // Parse error message for better user feedback
        const errorMsg = uploadErr.message || uploadErr.toString()
        
        if (errorMsg.includes('insufficient funds')) {
          throw new Error('Insufficient funds for transaction. Please add more OG tokens to your wallet.')
        } else if (errorMsg.includes('nonce')) {
          throw new Error('Transaction nonce error. Please try again.')
        } else if (errorMsg.includes('gas required exceeds')) {
          throw new Error('Gas limit exceeded. The file might be too large.')
        } else if (errorMsg.includes('Failed to submit transaction')) {
          // This is what we're getting - let's check the wallet
          const currentBalance = await provider.getBalance(wallet.address)
          console.log('Current balance after error:', ethers.formatEther(currentBalance), 'OG')
          
          throw new Error(`Transaction submission failed. Please ensure you have enough OG tokens (current: ${ethers.formatEther(currentBalance)} OG)`)
        }
        
        throw new Error(`Storage upload failed: ${errorMsg}`)
      }

      console.log('Upload transaction submitted:', uploadTx)
      
      // Wait for transaction confirmation with timeout
      try {
        const receipt = await Promise.race([
          provider.waitForTransaction(uploadTx, 1, 60000), // 1 confirmation, 60s timeout
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction confirmation timeout')), 65000)
          )
        ])
        console.log('Transaction confirmed in block:', receipt?.blockNumber)
      } catch (waitError) {
        console.log('Transaction submitted but confirmation timed out. TX hash:', uploadTx)
        // Continue anyway - transaction was submitted
      }
      
      const fileSize = zgFile.size()
      await zgFile.close()

      return {
        rootHash: tree.rootHash(),
        txHash: uploadTx,
        size: fileSize,
        segments: Math.ceil(fileSize / 256 / 1024) // segments calculation
      }
      
    } catch (uploadError: any) {
      console.error('Upload error full details:', uploadError)
      
      // Additional debugging
      try {
        const nonce = await provider.getTransactionCount(wallet.address)
        console.log('Current nonce:', nonce)
        
        const gasPrice = await provider.getFeeData()
        console.log('Network gas price:', ethers.formatUnits(gasPrice.gasPrice || 0n, 'gwei'), 'gwei')
      } catch (debugError) {
        console.error('Debug info error:', debugError)
      }
      
      throw uploadError
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

// downloadFromStorage остается без изменений
export async function downloadFromStorage(rootHash: string): Promise<string> {
  console.log('=== Storage Download Debug ===')
  console.log('Downloading file with root hash:', rootHash)
  
  const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  const tempPath = path.join(process.cwd(), 'tmp', `download-${Date.now()}.tmp`)
  
  try {
    const indexer = new Indexer(indexerRpc)
    
    // Ensure tmp directory exists
    const tempDir = path.dirname(tempPath)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    const downloadError = await indexer.download(rootHash, tempPath, false)
    
    if (downloadError) {
      console.error('Download error:', downloadError)
      throw downloadError
    }
    
    console.log('Download successful, reading file...')
    const content = await fs.promises.readFile(tempPath, 'utf-8')
    
    // Clean up
    await fs.promises.unlink(tempPath).catch(() => {})
    
    return content
  } catch (error) {
    console.error('0G Storage download error:', error)
    
    // Return default metadata if file not found
    return JSON.stringify({
      name: 'Unknown Agent',
      description: 'Metadata not available',
      model: 'Unknown',
      error: 'metadata_not_found'
    })
  }
}

export class StorageError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'StorageError'
  }
}