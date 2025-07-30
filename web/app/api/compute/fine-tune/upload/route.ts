import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker.server'
import { uploadToStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('[fine-tune-upload] Starting dataset upload...')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const agentId = formData.get('agentId') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('[fine-tune-upload] File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      agentId
    })

    // Read file content
    const fileContent = await file.text()
    console.log('[fine-tune-upload] File content preview:', fileContent.substring(0, 200) + '...')
    
    // Parse dataset and count examples
    let dataSize = 0
    try {
      const lines = fileContent.trim().split('\n').filter(line => line.trim())
      dataSize = lines.length
      console.log('[fine-tune-upload] Dataset contains', dataSize, 'examples')
    } catch (error) {
      console.warn('[fine-tune-upload] Could not parse dataset for counting:', error)
    }

    // Upload to 0G Storage
    const filename = `dataset-${agentId}-${Date.now()}.txt`
    console.log('[fine-tune-upload] Uploading to 0G Storage as:', filename)
    
    const result = await uploadToStorage(fileContent, filename)
    console.log('[fine-tune-upload] Upload result:', result)

    // Clean rootHash if needed
    let rootHash = result.rootHash
    if (rootHash.includes('http://') || rootHash.includes('https://')) {
      const parts = rootHash.split('/')
      rootHash = parts[parts.length - 1]
      console.log('[fine-tune-upload] Cleaned rootHash:', rootHash)
    }

    return NextResponse.json({
      success: true,
      rootHash,
      dataSize,
      filename,
      uploadSize: file.size,
      message: `Dataset uploaded successfully with ${dataSize} examples`
    })

  } catch (error) {
    console.error('[fine-tune-upload] Upload failed:', error)
    
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