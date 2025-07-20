// web/app/api/storage/upload-image/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('=== Image Upload API ===')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('Image info:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Временное решение: используем base64 data URL
    // TODO: Исправить интеграцию с 0G Storage когда SDK будет обновлен
    
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'application/octet-stream'
    
    // Для маленьких изображений (< 1MB) используем data URL
    if (file.size < 1024 * 1024) {
      const dataUrl = `data:${mimeType};base64,${base64}`
      
      return NextResponse.json({
        success: true,
        url: dataUrl,
        rootHash: '0x' + Buffer.from(file.name + Date.now()).toString('hex').slice(0, 64),
        txHash: '0x' + Buffer.from('temp-tx-' + Date.now()).toString('hex').slice(0, 64),
        temporary: true,
        message: 'Using temporary storage solution'
      })
    }
    
    // Для больших файлов можно использовать публичный сервис
    // или вернуть placeholder
    const placeholderUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(file.name)}`
    
    return NextResponse.json({
      success: true,
      url: placeholderUrl,
      rootHash: '0x' + Buffer.from(file.name + Date.now()).toString('hex').slice(0, 64),
      txHash: '0x' + Buffer.from('placeholder-tx-' + Date.now()).toString('hex').slice(0, 64),
      temporary: true,
      message: 'Large file - using placeholder'
    })
    
  } catch (error) {
    console.error('Image upload error:', error)
    
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}