// web/lib/storage/temp-metadata-store.ts
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

// Временное решение для хранения метаданных локально
// пока решаются проблемы с газом в 0G Storage

const METADATA_DIR = path.join(process.cwd(), 'data', 'metadata')

// Ensure metadata directory exists
async function ensureMetadataDir() {
  try {
    await fs.mkdir(METADATA_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating metadata directory:', error)
  }
}

export async function storeMetadataLocally(metadata: any): Promise<string> {
  await ensureMetadataDir()
  
  // Generate hash for metadata
  const content = JSON.stringify(metadata)
  const hash = '0x' + crypto.createHash('sha256').update(content).digest('hex')
  
  // Store in local file
  const filePath = path.join(METADATA_DIR, `${hash}.json`)
  await fs.writeFile(filePath, content, 'utf-8')
  
  console.log('Metadata stored locally:', hash)
  return hash
}

export async function retrieveMetadataLocally(hash: string): Promise<any> {
  try {
    const filePath = path.join(METADATA_DIR, `${hash}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error retrieving local metadata:', error)
    return null
  }
}

// Hybrid approach - try 0G first, fallback to local
export async function hybridStoreMetadata(
  metadata: any,
  uploadTo0G: (content: string) => Promise<{ rootHash: string }>
): Promise<{ rootHash: string; local: boolean }> {
  try {
    // Try 0G Storage first
    const result = await uploadTo0G(JSON.stringify(metadata))
    return { rootHash: result.rootHash, local: false }
  } catch (error) {
    console.warn('0G Storage failed, using local storage:', error)
    
    // Fallback to local storage
    const localHash = await storeMetadataLocally(metadata)
    return { rootHash: localHash, local: true }
  }
}

export async function hybridRetrieveMetadata(
  rootHash: string,
  downloadFrom0G: (hash: string) => Promise<Blob>
): Promise<any> {
  // First try local storage (fast)
  const localData = await retrieveMetadataLocally(rootHash)
  if (localData) {
    return localData
  }
  
  // Then try 0G Storage
  try {
    const blob = await downloadFrom0G(rootHash)
    const content = await blob.text()
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to retrieve from 0G:', error)
    
    // Return default metadata
    return {
      name: 'Unknown Agent',
      description: 'Metadata not available',
      model: 'Unknown',
      error: 'metadata_not_found'
    }
  }
}

// web/app/api/storage/upload/route.ts - обновленная версия с гибридным подходом
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client-server'

export async function uploadPOST(request: NextReq) {
  console.log('=== Storage Upload API ===')
  
  try {
    const contentType = request.headers.get('content-type') || ''
    
    // Handle JSON requests
    if (contentType.includes('application/json')) {
      const body = await request.json()
      
      // Support both 'content' and 'metadata' fields
      const content = body.content || (body.metadata ? JSON.stringify(body.metadata) : null)
      const filename = body.filename || `upload-${Date.now()}.json`
      
      if (!content) {
        return NextResponse.json(
          { error: 'No content or metadata provided' },
          { status: 400 }
        )
      }

      const contentSize = Buffer.byteLength(content)
      console.log('Uploading JSON content, size:', contentSize, 'bytes')
      
      // Parse metadata if it's a string
      let metadata = content
      if (typeof content === 'string') {
        try {
          metadata = JSON.parse(content)
        } catch {
          // Not JSON, use as is
        }
      }
      
      // Use hybrid approach for metadata
      if (contentSize > 50 * 1024) { // 50KB threshold
        console.log('Content too large for reliable 0G upload, using hybrid approach')
        
        // Minify metadata
        const minified = {
          name: metadata.name,
          description: metadata.description,
          model: metadata.model,
          personality: metadata.personality,
          image: metadata.image?.substring(0, 100) + '...', // Truncate large images
          creator: metadata.creator,
          createdAt: metadata.createdAt,
          expertise: metadata.expertise,
          skills: metadata.skills
        }
        
        // Try hybrid storage
        const result = await hybridStoreMetadata(minified, async (content) => {
          return await uploadToStorage(content, filename)
        })
        
        return NextResponse.json({
          rootHash: result.rootHash,
          txHash: result.local ? 'local-storage' : undefined,
          size: Buffer.byteLength(JSON.stringify(minified)),
          segments: 1,
          local: result.local,
          minified: true
        })
      }
      
      // For small content, try 0G directly with fallback
      try {
        const result = await uploadToStorage(content, filename)
        return NextResponse.json(result)
      } catch (error: any) {
        console.warn('0G upload failed, using local storage:', error.message)
        
        // Fallback to local storage
        const { rootHash } = await hybridStoreMetadata(
          typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
          async () => { throw error } // Force local storage
        )
        
        return NextResponse.json({
          rootHash,
          txHash: 'local-storage',
          size: contentSize,
          segments: 1,
          local: true,
          error: '0G Storage unavailable, using local storage'
        })
      }
    }
    
    // Handle FormData (file uploads) - existing code...
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // For files, always try local storage first
    const fileContent = await file.text()
    const { rootHash } = await hybridStoreMetadata(
      { 
        filename: file.name, 
        content: fileContent,
        type: file.type 
      },
      async () => { throw new Error('File uploads use local storage') }
    )
    
    return NextResponse.json({
      rootHash,
      txHash: 'local-storage',
      size: file.size,
      segments: 1,
      local: true
    })
    
  } catch (error: any) {
    console.error('Storage upload error:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to upload',
        details: error.toString()
      },
      { status: 500 }
    )
  }
}

// web/app/api/storage/retrieve/route.ts - обновленная версия
import type { NextRequest as NextReq } from 'next/server'
import { NextResponse as NextRes } from 'next/server'
import { downloadFromStorage } from '@/lib/storage/client-server'

export async function retrievePOST(request: NextReq) {
  try {
    const { rootHash } = await request.json()
    
    if (!rootHash) {
      return NextResponse.json(
        { error: 'Root hash is required' },
        { status: 400 }
      )
    }

    console.log('Retrieving data for root hash:', rootHash)
    
    // Use hybrid retrieval
    const metadata = await hybridRetrieveMetadata(rootHash, downloadFromStorage)
    
    // Ensure we return a string
    const content = typeof metadata === 'string' ? metadata : JSON.stringify(metadata)
    
    console.log('Retrieved content preview:', content.substring(0, 200) + '...')
    
    return NextResponse.json({
      success: true,
      content,
      rootHash,
    })
  } catch (error) {
    console.error('Retrieve error:', error)
    
    // Return default metadata
    return NextResponse.json({
      success: true,
      content: JSON.stringify({
        name: 'Unknown Agent',
        description: 'Metadata not available',
        model: 'Unknown',
        error: 'retrieval_failed'
      })
    })
  }
}