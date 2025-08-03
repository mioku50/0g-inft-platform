export const runtime = 'nodejs'

import { hashAndExists } from '@/lib/storage/client-server'
import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk'
import { ethers } from 'ethers'
import * as fs from 'fs/promises'
import path from 'path'

interface UploadResult {
  rootHash: string
  txHash?: string
  size: number
  segments?: number
  alreadyExists: boolean
}

export async function POST(req: Request) {
  console.log('[upload-dataset] POST hit')
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return Response.json({ error: 'file is required' }, { status: 400 })

    console.log('[upload-dataset] file:', file.name, file.size, 'type:', file.type)

    // Validate file format
    const fileName = file.name.toLowerCase()
    const supportedFormats = ['.jsonl', '.json', '.txt']
    const isSupported = supportedFormats.some(format => fileName.endsWith(format))
    
    if (!isSupported) {
      return Response.json({ 
        success: false, 
        error: `Unsupported file format. Supported formats: ${supportedFormats.join(', ')}` 
      }, { status: 400 })
    }

    // Convert file content if needed
    let processedFile = file
    
    if (fileName.endsWith('.json') || fileName.endsWith('.txt')) {
      console.log('[upload-dataset] Converting file format to JSONL...')
      const content = await file.text()
      const jsonlContent = await convertToJsonl(content, fileName)
      const jsonlBlob = new Blob([jsonlContent], { type: 'application/jsonl' })
      processedFile = new File([jsonlBlob], file.name.replace(/\.(json|txt)$/, '.jsonl'), { type: 'application/jsonl' })
      console.log('[upload-dataset] Converted to JSONL, new size:', processedFile.size)
    }

    // Always upload to 0G Storage network - never return local:// roots
    const result = await uploadToNetworkStorage(processedFile)
    
    console.log('[upload-dataset] Upload successful:', { 
      rootHash: result.rootHash.slice(0, 20) + '...', 
      size: result.size,
      alreadyExists: result.alreadyExists 
    })
    
    // Add validation step as required
    const networkOnly = new URL(req.url).searchParams.get('networkOnly') === '1'
    if (networkOnly || true) { // Always validate for now
      console.log('[upload-dataset] Validating network accessibility...')
      const isAccessible = await validateNetworkAccess(result.rootHash)
      console.log(`[upload-dataset] Network validation: ${isAccessible ? 'PASS' : 'FAIL'}`)
      
      if (!isAccessible) {
        console.warn('[upload-dataset] Warning: File may not be immediately accessible via indexer')
      }
    }
    
    return Response.json({ 
      success: true, 
      rootHash: result.rootHash, 
      size: result.size,
      alreadyExists: result.alreadyExists
    })

  } catch (e: any) {
    console.error('[upload-dataset] error', e)
    return Response.json({ 
      success: false, 
      error: e?.message || 'upload failed' 
    }, { status: 500 })
  }
}

/**
 * Upload file to 0G Storage network and always return network root hash
 * Never returns local:// format as per requirements
 */
async function uploadToNetworkStorage(file: File): Promise<UploadResult> {
  const data = Buffer.from(await file.arrayBuffer())
  
  // Step 1: Calculate network root hash and check if file exists
  console.log('[upload-dataset] Calculating network root hash...')
  const { root: networkRoot, exists } = await hashAndExists(data)
  
  if (!networkRoot.startsWith('0x')) {
    console.error('[upload-dataset] Invalid network root format:', networkRoot)
    throw new Error('Failed to calculate valid network root hash')
  }
  
  console.log(`[upload-dataset] Network root: ${networkRoot}, exists: ${exists}`)
  
  if (exists) {
    console.log('[upload-dataset] File already exists in 0G Storage, returning existing root')
    return {
      rootHash: networkRoot,
      size: data.length,
      alreadyExists: true
    }
  }
  
  // Step 2: Upload to 0G Storage if file doesn't exist
  console.log('[upload-dataset] Uploading to 0G Storage...')
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_STORAGE_PRIVATE_KEY not configured')
  }
  
  const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
  const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  
  const provider = new ethers.JsonRpcProvider(evmRpc)
  const wallet = new ethers.Wallet(privateKey, provider)
  
  // Create temporary file for 0G SDK
  const tempDir = path.join(process.cwd(), 'tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `upload-${Date.now()}-${file.name}`)
  await fs.writeFile(tempFile, data)
  
  try {
    const zgFile = await ZgFile.fromFilePath(tempFile)
    const [tree] = await zgFile.merkleTree()
    const calculatedRoot = tree!.rootHash() as string
    
    // Verify the calculated root matches our expected network root
    if (calculatedRoot !== networkRoot) {
      console.warn(`[upload-dataset] Root mismatch: calculated=${calculatedRoot}, expected=${networkRoot}`)
    }
    
    const indexer = new Indexer(indexerRpc)
    
    // Upload with retry logic
    let lastError: any
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[upload-dataset] Upload attempt ${attempt}/3...`)
        const feeData = await provider.getFeeData()
        const gasPrice = (feeData.gasPrice || ethers.parseUnits('1', 'gwei')) * BigInt(attempt)
        
        const [txHash, error] = await indexer.upload(zgFile, evmRpc, wallet, undefined, undefined, { gasPrice })
        
        if (!error) {
          const size = zgFile.size()
          await zgFile.close()
          await fs.unlink(tempFile).catch(() => {})
          
          console.log(`[upload-dataset] Upload successful: tx=${txHash}, root=${networkRoot}`)
          return {
            rootHash: networkRoot, // Always return the network root format
            txHash,
            size,
            segments: Math.ceil(size / 256 / 1024),
            alreadyExists: false
          }
        }
        
        lastError = error
        console.warn(`[upload-dataset] Upload attempt ${attempt} failed:`, error)
        
      } catch (uploadError) {
        lastError = uploadError
        console.warn(`[upload-dataset] Upload attempt ${attempt} error:`, uploadError)
      }
    }
    
    await zgFile.close()
    throw new Error(`Upload failed after 3 attempts: ${lastError}`)
    
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}

/**
 * Validate that uploaded file is accessible via 0G Storage indexer
 * Performs HEAD request to indexer as required
 */
async function validateNetworkAccess(rootHash: string): Promise<boolean> {
  try {
    const indexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_URL || 'https://indexer-storage-testnet-turbo.0g.ai'
    const cleanHash = rootHash.replace('0x', '')
    
    // Perform HEAD request to indexer
    const headUrl = `${indexerRpc}/${rootHash}`
    console.log(`[upload-dataset] Validating access: HEAD ${headUrl}`)
    
    const response = await fetch(headUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })
    
    console.log(`[upload-dataset] HEAD response: ${response.status} ${response.statusText}`)
    return response.ok
    
  } catch (error: any) {
    console.warn(`[upload-dataset] Network validation failed: ${error.message}`)
    return false
  }
}

/**
 * Convert different file formats to JSONL
 */
async function convertToJsonl(content: string, fileName: string): Promise<string> {
  const isJson = fileName.endsWith('.json')
  const isTxt = fileName.endsWith('.txt')
  
  if (isJson) {
    try {
      const parsed = JSON.parse(content)
      const lines: string[] = []
      
      // Handle different JSON structures
      if (Array.isArray(parsed)) {
        // Array of objects
        for (const item of parsed) {
          if (item.messages) {
            lines.push(JSON.stringify(item))
          } else {
            // Convert to message format
            lines.push(JSON.stringify({
              messages: [
                { role: "user", content: String(item.input || item.question || item.text || item) },
                { role: "assistant", content: String(item.output || item.answer || item.response || "I understand.") }
              ]
            }))
          }
        }
      } else if (parsed.data && Array.isArray(parsed.data)) {
        // Data wrapper format
        for (const item of parsed.data) {
          lines.push(JSON.stringify(item))
        }
      } else {
        // Single object
        if (parsed.messages) {
          lines.push(JSON.stringify(parsed))
        } else {
          lines.push(JSON.stringify({
            messages: [
              { role: "user", content: "Convert this data" },
              { role: "assistant", content: JSON.stringify(parsed) }
            ]
          }))
        }
      }
      
      return lines.join('\n')
    } catch (error) {
      throw new Error('Invalid JSON format')
    }
  } else if (isTxt) {
    // Convert text to JSONL format
    const lines = content.split('\n').filter(line => line.trim())
    const jsonlLines: string[] = []
    
    // Group lines into conversations (simple heuristic)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line) {
        // Create a simple user-assistant pair
        jsonlLines.push(JSON.stringify({
          messages: [
            { role: "user", content: "Please process this text" },
            { role: "assistant", content: line }
          ]
        }))
      }
    }
    
    return jsonlLines.join('\n')
  }
  
  return content
}
