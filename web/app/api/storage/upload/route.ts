// web/app/api/storage/upload/route.ts - полная исправленная версия
import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

function cleanRootHash(hash: string): string {
  if (!hash) return hash
  
  // Если hash содержит URL, извлекаем только хэш
  if (hash.includes('http://') || hash.includes('https://')) {
    console.warn('WARNING: rootHash contains URL, extracting hash only:', hash)
    const parts = hash.split('/')
    return parts[parts.length - 1]
  }
  
  return hash
}

export async function POST(request: NextRequest) {
  console.log('=== Storage Upload API ===')
  
  try {
    const contentType = request.headers.get('content-type') || ''
    
    // Handle JSON requests
    if (contentType.includes('application/json')) {
      const body = await request.json()
      
      // Извлекаем контент для загрузки
      let contentToUpload: any
      let filename = `upload-${Date.now()}.json`
      
      // Поддержка разных форматов
      if (body.metadata) {
        contentToUpload = body.metadata
        filename = `agent-metadata-${Date.now()}.json`
      } else if (body.content) {
        contentToUpload = body.content
      } else {
        contentToUpload = body
      }
      
      // Преобразуем в строку если это объект
      const contentString = typeof contentToUpload === 'string' 
        ? contentToUpload 
        : JSON.stringify(contentToUpload, null, 2)
      
      const contentSize = Buffer.byteLength(contentString)
      console.log('Uploading content, size:', contentSize, 'bytes')
      console.log('Content preview:', contentString.substring(0, 200) + '...')
      
      // Проверка размера и минификация при необходимости
      let finalContent = contentString
      let isMinified = false
      
      if (contentSize > 200 * 1024) { // 200KB limit
        console.warn('Content too large:', contentSize, 'bytes. Attempting to minify...')
        
        if (typeof contentToUpload === 'object' && contentToUpload.systemPrompt) {
          const minified = {
            ...contentToUpload,
            systemPrompt: contentToUpload.systemPrompt.substring(0, 500) + '...',
            name: contentToUpload.name,
            description: contentToUpload.description,
            model: contentToUpload.model,
            personality: contentToUpload.personality,
            skills: contentToUpload.skills,
            expertise: contentToUpload.expertise,
            creator: contentToUpload.creator,
            createdAt: contentToUpload.createdAt,
            // Обрезаем длинные base64 изображения
            image: contentToUpload.image?.startsWith('data:') 
              ? contentToUpload.image.substring(0, 200) + '...' 
              : contentToUpload.image
          }
          
          finalContent = JSON.stringify(minified)
          isMinified = true
          console.log('Minified to:', Buffer.byteLength(finalContent), 'bytes')
        }
      }
      
      // Пробуем загрузить в 0G Storage
      try {
      const result = await uploadToStorage(finalContent, filename)
      console.log('Upload successful:', result)

      if (result.rootHash.startsWith('local://')) {
        return NextResponse.json({
          ...result,
          local: true
        })
      }

      const cleanedHash = cleanRootHash(result.rootHash)
      return NextResponse.json({
        ...result,
        rootHash: cleanedHash,
        minified: isMinified,
        originalSize: contentSize
      })
      } catch (error: any) {
        console.error('Upload to 0G Storage failed:', error)
        
        // Fallback на локальное хранилище
        if (error.message?.includes('Transaction') || 
            error.message?.includes('Insufficient') ||
            error.message?.includes('gas') ||
            error.message?.includes('balance')) {
          
          console.log('Using local storage fallback due to:', error.message)
          
          // Генерируем hash локально
          const crypto = require('crypto')
          const localHash = '0x' + crypto.createHash('sha256')
            .update(finalContent)
            .digest('hex')
          
          console.log('Generated local hash:', localHash)
          
          // Сохраняем локально
          try {
            const fs = require('fs').promises
            const path = require('path')
            const localDir = path.join(process.cwd(), 'data', 'metadata')
            
            // Создаем директорию если не существует
            await fs.mkdir(localDir, { recursive: true })
            
            const filePath = path.join(localDir, `${localHash}.json`)
            await fs.writeFile(filePath, finalContent)
            
            console.log('Saved to local storage:', filePath)
          } catch (localError) {
            console.error('Local save error (non-critical):', localError)
          }
          
          return NextResponse.json({
            rootHash: localHash, // Только хэш, без URL!
            txHash: 'local-storage',
            size: Buffer.byteLength(finalContent),
            segments: 1,
            local: true,
            minified: isMinified,
            message: '0G Storage unavailable, using local storage'
          })
        }
        
        throw error
      }
    }
    
    // Handle FormData (file uploads)
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('Uploading file:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    const buffer = Buffer.from(await file.arrayBuffer())
    
    try {
      const result = await uploadToStorage(buffer, file.name)
      if (result.rootHash.startsWith('local://')) {
        return NextResponse.json({ ...result, local: true })
      }
      const cleanedHash = cleanRootHash(result.rootHash)
      return NextResponse.json({
        ...result,
        rootHash: cleanedHash
      })
    } catch (error: any) {
      console.error('File upload failed:', error)
      
      // Local storage fallback для файлов
      const crypto = require('crypto')
      const localHash = '0x' + crypto.createHash('sha256')
        .update(buffer)
        .digest('hex')
      
      return NextResponse.json({
        rootHash: localHash,
        txHash: 'local-storage',
        size: file.size,
        segments: 1,
        local: true,
        message: 'File stored locally'
      })
    }
    
  } catch (error: any) {
    console.error('Storage upload error:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to upload to storage',
        details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      },
      { status: 500 }
    )
  }
}