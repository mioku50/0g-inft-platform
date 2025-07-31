import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker.server'
import { uploadToStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

const DEBUG_FINE_TUNE = process.env.DEBUG_FINE_TUNE === 'true'

export async function POST(request: NextRequest) {
  if (DEBUG_FINE_TUNE) console.log('[UPLOAD-API] 🚀 Starting dataset upload...')
  
  try {
    // Check environment variables first
    const storageKey = process.env.OG_STORAGE_PRIVATE_KEY
    if (!storageKey) {
      console.error('[UPLOAD-API] ❌ OG_STORAGE_PRIVATE_KEY not configured')
      return NextResponse.json(
        { 
          error: 'Storage not configured', 
          details: 'OG_STORAGE_PRIVATE_KEY environment variable is missing',
          success: false
        },
        { status: 503 }
      )
    }

    if (DEBUG_FINE_TUNE) console.log('[UPLOAD-API] ✅ Environment variables validated')

    const formData = await request.formData()
    const file = formData.get('file') as File
    const agentId = formData.get('agentId') as string
    
    if (DEBUG_FINE_TUNE) console.log('[UPLOAD-API] 📋 Request data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      agentId
    })
    
    if (!file) {
      if (DEBUG_FINE_TUNE) console.log('[UPLOAD-API] ❌ No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      agentId
    })

    // Read file content
    const fileContent = await file.text()
    if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] File content preview:', fileContent.substring(0, 200) + '...')
    
    // Parse dataset and count examples
    let dataSize = 0
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      
      if (fileExtension === 'json') {
        // Handle JSON format - could be array of objects or single object
        const jsonData = JSON.parse(fileContent)
        if (Array.isArray(jsonData)) {
          dataSize = jsonData.length
        } else if (jsonData.messages) {
          dataSize = 1 // Single conversation
        } else {
          dataSize = 1 // Fallback for other JSON structures
        }
        if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] JSON dataset contains', dataSize, 'examples')
      } else {
        // Handle JSONL format (default) - count non-empty lines
        const lines = fileContent.trim().split('\n').filter(line => line.trim())
        dataSize = lines.length
        if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] JSONL dataset contains', dataSize, 'examples')
      }
    } catch (error) {
      console.warn('[fine-tune-upload] Could not parse dataset for counting:', error)
      // Fallback to line counting
      const lines = fileContent.trim().split('\n').filter(line => line.trim())
      dataSize = lines.length
    }

    // Upload to 0G Storage
    const filename = `dataset-${agentId}-${Date.now()}.txt`
    if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] Uploading to 0G Storage as:', filename)
    
    const result = await uploadToStorage(fileContent, filename)
    if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] Upload result:', result)

    // Clean rootHash if needed
    let rootHash = result.rootHash
    if (rootHash.includes('http://') || rootHash.includes('https://')) {
      const parts = rootHash.split('/')
      rootHash = parts[parts.length - 1]
      if (DEBUG_FINE_TUNE) console.log('[fine-tune-upload] Cleaned rootHash:', rootHash)
    }

    const response = {
      success: true,
      rootHash,
      dataSize,
      filename,
      uploadSize: file.size,
      message: `Dataset uploaded successfully with ${dataSize} examples`
    }

    if (DEBUG_FINE_TUNE) console.log('[UPLOAD-API] ✅ Upload successful:', response)
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('[UPLOAD-API] ❌ Upload failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Upload failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}