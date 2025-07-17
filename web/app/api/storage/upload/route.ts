// web/app/api/storage/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client-server'

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
    
    let content: string | Buffer
    let filename: string = 'metadata.json'

    if (contentType.includes('multipart/form-data')) {
      // Обработка FormData
      const formData = await request.formData()
      const file = formData.get('file') as File
      
      if (file) {
        // Преобразуем File в Buffer
        const arrayBuffer = await file.arrayBuffer()
        content = Buffer.from(arrayBuffer)
        filename = file.name
        
        console.log('File info:', {
          name: file.name,
          size: file.size,
          type: file.type
        })
      } else {
        // Если файла нет, проверяем metadata
        const metadataStr = formData.get('metadata') as string
        if (metadataStr) {
          content = metadataStr
          filename = 'metadata.json'
        } else {
          throw new Error('No file or metadata provided')
        }
      }
    } else if (contentType.includes('application/json')) {
      // Обработка JSON
      const body = await request.json()
      
      if (body.content) {
        // Если есть content - используем его напрямую
        content = body.content
        filename = body.filename || 'metadata.json'
      } else if (body.metadata) {
        // Если есть metadata - сериализуем
        content = JSON.stringify(body.metadata)
        filename = 'metadata.json'
      } else {
        throw new Error('No content or metadata provided')
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Expected multipart/form-data or application/json' },
        { status: 400 }
      )
    }

    console.log('Uploading to storage:', {
      contentType: typeof content,
      contentSize: content.length,
      filename: filename
    })

    // Upload to 0G Storage
    const result = await uploadToStorage(content, filename)
    
    console.log('Upload successful:', {
      rootHash: result.rootHash,
      txHash: result.txHash
    })

    return NextResponse.json({
      success: true,
      rootHash: result.rootHash,
      txHash: result.txHash
    })
  } catch (error: any) {
    console.error('Storage upload error:', error)
    
    return NextResponse.json(
      { error: error.message || 'Failed to upload to storage' },
      { status: 500 }
    )
  }
}