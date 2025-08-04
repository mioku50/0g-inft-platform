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
    
    // Post-upload validation with proper TOO_EARLY_INDEXING handling (as per requirements)
    const networkOnly = new URL(req.url).searchParams.get('networkOnly') === '1'
    if (networkOnly || true) { // Always validate for now per requirements
      console.log('[upload-dataset] Post-upload: Validating network accessibility with exponential backoff...')
      
      // Implement exponential backoff strategy as per requirements: 5s, 10s, 15s, 20s, 30s
      const backoffDelays = [5000, 10000, 15000, 20000, 30000]
      let isAccessible = false
      
      for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
        console.log(`[upload-dataset] Accessibility check attempt ${attempt + 1}/${backoffDelays.length}...`)
        
        try {
          isAccessible = await validateNetworkAccess(result.rootHash)
          
          if (isAccessible) {
            console.log(`✅ Dataset confirmed accessible on Turbo indexer (attempt ${attempt + 1})`)
            break
          } else {
            console.warn(`⚠️  Dataset not yet accessible via Turbo indexer (attempt ${attempt + 1}/${backoffDelays.length})`)
            
            if (attempt < backoffDelays.length - 1) {
              const delayMs = backoffDelays[attempt]
              console.log(`⏳ Waiting ${delayMs}ms before next accessibility check...`)
              await new Promise(resolve => setTimeout(resolve, delayMs))
            }
          }
        } catch (validationError: any) {
          console.warn(`⚠️  Turbo validation error (attempt ${attempt + 1}): ${validationError.message}`)
          
          if (attempt < backoffDelays.length - 1) {
            const delayMs = backoffDelays[attempt]
            console.log(`⏳ Waiting ${delayMs}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
          }
        }
      }
      
      // If not accessible after all retries, return 425 TOO_EARLY_INDEXING as per requirements
      if (!isAccessible) {
        console.error('❌ Dataset not accessible on Turbo indexer after all retries')
        return Response.json({
          error: 'TOO_EARLY_INDEXING',
          details: 'Dataset uploaded successfully but not yet accessible via Turbo indexer. Please wait for indexing to complete.',
          rootHash: result.rootHash,
          size: result.size,
          indexingStatus: 'pending',
          helpfulMessage: 'The dataset is being indexed by the Turbo indexer. This usually takes 1-5 minutes. Please try again shortly.',
          retryAfterSec: 120 // Suggest retry after 2 minutes
        }, { status: 425 })
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
 * Upload file to 0G Storage Turbo network and always return network root hash
 * CRITICAL FIX: Always returns 0x network format, never local:// format
 * This prevents "file not found" errors from providers
 * IMPORTANT: Only uses Turbo indexer - no fallback to Standard per requirements
 * Turbo indexer only strategy ensures consistent dataset accessibility
 * Never returns local:// format as per requirements
 */
async function uploadToNetworkStorage(file: File): Promise<UploadResult> {
  const data = Buffer.from(await file.arrayBuffer())
  
  // Step 1: Calculate network root hash before upload using 0G SDK
  console.log('[upload-dataset] Calculating 0x network root hash using 0G SDK...')
  
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('OG_STORAGE_PRIVATE_KEY not configured')
  }
  
  // IMPORTANT: Only use Turbo indexer per requirements - no fallback to Standard
  const turboIndexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_TURBO_URL || 
                          process.env.NEXT_PUBLIC_0G_STORAGE_URL || 
                          'https://indexer-storage-testnet-turbo.0g.ai'
  const TURBO_URL = turboIndexerRpc // Turbo indexer only per requirements
  const evmRpc = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  
  console.log(`[upload-dataset] Using Turbo indexer only: ${TURBO_URL}`)
  console.log(`[upload-dataset] Using EVM RPC: ${evmRpc}`)
  
  // Create temporary file for 0G SDK to calculate proper network root
  const tempDir = path.join(process.cwd(), 'tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const tempFile = path.join(tempDir, `upload-${Date.now()}-${file.name}`)
  await fs.writeFile(tempFile, data)
  
  let networkRoot: string
  let alreadyExists = false
  
  try {
    const zgFile = await ZgFile.fromFilePath(tempFile)
    const [tree] = await zgFile.merkleTree()
    networkRoot = tree!.rootHash() as string
    
    if (!networkRoot.startsWith('0x')) {
      console.error('[upload-dataset] Invalid network root format from SDK:', networkRoot)
      throw new Error('0G SDK returned invalid network root hash format')
    }
    
    console.log(`[upload-dataset] ✅ Calculated network root: ${networkRoot}`)
    
    // Step 2: Check if file already exists on Turbo indexer before upload
    const turboCheckUrl = `${turboIndexerRpc}/${networkRoot}`
    console.log(`[upload-dataset] Checking if file exists on Turbo: HEAD ${turboCheckUrl}`)
    
    try {
      const headResponse = await fetch(turboCheckUrl, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      if (headResponse.ok) {
        console.log('[upload-dataset] ✅ File already exists on Turbo indexer, returning existing root')
        await zgFile.close()
        await fs.unlink(tempFile).catch(() => {})
        
        // CRITICAL: Always return 0x format - never local://
        return {
          rootHash: networkRoot, // Always return 0x format
          size: data.length,
          alreadyExists: true
        }
      } else {
        console.log(`[upload-dataset] File not found on Turbo (${headResponse.status}), proceeding with upload`)
      }
    } catch (checkError: any) {
      console.log(`[upload-dataset] Could not verify file existence on Turbo: ${checkError.message}`)
      console.log('[upload-dataset] Proceeding with upload...')
    }
    
    // Step 3: Upload to Turbo indexer with retry logic
    const provider = new ethers.JsonRpcProvider(evmRpc)
    const wallet = new ethers.Wallet(privateKey, provider)
    
    // Create Turbo indexer instance (no fallback to Standard per requirements)
    const turboIndexer = new Indexer(turboIndexerRpc)
    
    console.log('[upload-dataset] Uploading to Turbo indexer with retry logic...')
    
    // Upload with retry logic for network resilience
    let lastError: any
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[upload-dataset] Upload attempt ${attempt}/3 to Turbo...`)
        const feeData = await provider.getFeeData()
        const gasPrice = (feeData.gasPrice || ethers.parseUnits('1', 'gwei')) * BigInt(attempt)
        
        const [txHash, error] = await turboIndexer.upload(zgFile, evmRpc, wallet, undefined, undefined, { gasPrice })
        
        if (!error) {
          const size = zgFile.size()
          await zgFile.close()
          await fs.unlink(tempFile).catch(() => {})
          
          console.log(`[upload-dataset] ✅ Upload successful to Turbo: tx=${txHash}, root=${networkRoot}`)
          
          // Post-upload validation: ensure file is accessible on Turbo
          console.log('[upload-dataset] Post-upload validation on Turbo indexer...')
          const isAccessible = await validateTurboAccess(networkRoot)
          if (!isAccessible) {
            console.warn('[upload-dataset] ⚠️ Warning: File may not be immediately accessible via Turbo indexer')
          } else {
            console.log('[upload-dataset] ✅ Post-upload validation successful')
          }
          
          // CRITICAL: Always return 0x network root format - never local://
          return {
            rootHash: networkRoot, // Always return 0x format
            txHash,
            size,
            segments: Math.ceil(size / 256 / 1024),
            alreadyExists: false
          }
        }
        
        lastError = error
        console.warn(`[upload-dataset] Turbo upload attempt ${attempt} failed:`, error)
        
      } catch (uploadError) {
        lastError = uploadError
        console.warn(`[upload-dataset] Turbo upload attempt ${attempt} error:`, uploadError)
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < 3) {
        const delayMs = Math.pow(2, attempt) * 1000 // 2s, 4s
        console.log(`[upload-dataset] Waiting ${delayMs}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    await zgFile.close()
    throw new Error(`Upload to Turbo failed after 3 attempts: ${lastError}`)
    
  } finally {
    await fs.unlink(tempFile).catch(() => {})
  }
}

/**
 * Validate that uploaded file is accessible via Turbo indexer
 * Performs HEAD request to Turbo indexer as required by specifications
 */
async function validateTurboAccess(rootHash: string): Promise<boolean> {
  try {
    // IMPORTANT: Only use Turbo indexer per requirements - no fallback to Standard
    const turboIndexerRpc = process.env.NEXT_PUBLIC_0G_STORAGE_TURBO_URL || 
                            process.env.NEXT_PUBLIC_0G_STORAGE_URL || 
                            'https://indexer-storage-testnet-turbo.0g.ai'
    
    // Perform HEAD request to Turbo indexer
    const headUrl = `${turboIndexerRpc}/${rootHash}`
    console.log(`[upload-dataset] Validating Turbo access: HEAD ${headUrl}`)
    
    const response = await fetch(headUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })
    
    console.log(`[upload-dataset] Turbo HEAD response: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      console.log('✅ Dataset confirmed accessible on Turbo indexer')
      return true
    } else {
      console.warn(`⚠️  Dataset may not be immediately accessible on Turbo: HTTP ${response.status}`)
      console.warn(`⚠️  URL: ${headUrl}`)
      console.warn(`⚠️  This may cause providers to fail with "file not found"`)
      return false
    }
    
  } catch (error: any) {
    console.warn(`⚠️  Turbo validation failed: ${error.message}`)
    return false
  }
}

/**
 * Enhanced network validation using only Turbo indexer
 */
async function validateNetworkAccess(rootHash: string): Promise<boolean> {
  return validateTurboAccess(rootHash)
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
