// web/app/api/storage/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage, StorageError } from '@/lib/storage/client-server'

export async function POST(request: NextRequest) {
  console.log('=== Storage Upload API Debug ===')
  console.log('Current directory:', process.cwd())
  
  const privateKey = process.env.OG_STORAGE_PRIVATE_KEY
  console.log('Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    hasStorageKey: !!privateKey,
    keyLength: privateKey?.length || 0,
    keyPrefix: privateKey ? privateKey.substring(0, 6) + '...' : 'not set'
  })

  if (!privateKey) {
    return NextResponse.json(
      { error: 'Storage key not configured' },
      { status: 500 }
    )
  }

  console.log('Using storage key:', privateKey.substring(0, 6) + '...')

  try {
    // Проверяем Content-Type
    const contentType = request.headers.get('content-type') || ''
    
    let file: File | null = null
    let metadata: any = null

    if (contentType.includes('multipart/form-data')) {
      // Обработка FormData
      const formData = await request.formData()
      file = formData.get('file') as File
      const metadataStr = formData.get('metadata') as string
      if (metadataStr) {
        metadata = JSON.parse(metadataStr)
      }
    } else if (contentType.includes('application/json')) {
      // Обработка JSON
      const body = await request.json()
      metadata = body.metadata
      
      // Если есть данные файла в base64
      if (body.fileData && body.fileName) {
        const buffer = Buffer.from(body.fileData, 'base64')
        const blob = new Blob([buffer], { type: body.fileType || 'application/octet-stream' })
        file = new File([blob], body.fileName, { type: body.fileType || 'application/octet-stream' })
      } else if (metadata) {
        // Создаем файл из метаданных
        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        file = new File([metadataBlob], 'metadata.json', { type: 'application/json' })
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Expected multipart/form-data or application/json' },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file or metadata provided' },
        { status: 400 }
      )
    }

    console.log('File info:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Upload to 0G Storage
    const result = await uploadToStorage(file, file.name)
    
    console.log('Upload successful:', {
      rootHash: result.rootHash,
      txHash: result.txHash,
      size: result.size
    })

    return NextResponse.json({
      success: true,
      rootHash: result.rootHash,
      txHash: result.txHash,
      size: result.size,
      segments: result.segments
    })
  } catch (error) {
    console.error('Storage upload error:', error)
    
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to upload to storage' },
      { status: 500 }
    )
  }
}