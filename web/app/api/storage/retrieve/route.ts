// web/app/api/storage/retrieve/route.ts - полная исправленная версия
import { NextRequest, NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/storage/client-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rootHash, tokenId } = body
    
    if (!rootHash && !tokenId) {
      return NextResponse.json(
        { error: 'Root hash or token ID is required' },
        { status: 400 }
      )
    }

    // Очищаем rootHash от возможного URL
    let cleanRootHash = rootHash
    if (rootHash && typeof rootHash === 'string') {
      // Если rootHash содержит URL, извлекаем только хэш
      if (rootHash.includes('http://') || rootHash.includes('https://')) {
        console.warn('Root hash contains URL, cleaning:', rootHash)
        const parts = rootHash.split('/')
        cleanRootHash = parts[parts.length - 1] // Берем последнюю часть после /
        console.log('Extracted hash:', cleanRootHash)
      }
      
      // Убеждаемся что это валидный хэш
      if (cleanRootHash && !cleanRootHash.startsWith('0x')) {
        console.warn('Invalid root hash format, adding 0x prefix:', cleanRootHash)
        // Некоторые хэши могут не иметь префикса 0x
        if (/^[a-fA-F0-9]{64}$/.test(cleanRootHash)) {
          cleanRootHash = '0x' + cleanRootHash
        }
      }
    }

    console.log('Retrieving data for root hash:', cleanRootHash)
    
    try {
      // Пробуем загрузить из 0G Storage
      const content = await downloadFromStorage(cleanRootHash)
      
      // Проверяем что получили валидный JSON
      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content
        console.log('Retrieved content preview:', JSON.stringify(parsed).substring(0, 200) + '...')
      } catch (e) {
        console.log('Retrieved non-JSON content')
      }
      
      return NextResponse.json({
        success: true,
        content,
        rootHash: cleanRootHash,
      })
    } catch (error: any) {
      console.error('Storage retrieval error:', error)
      
      // Если не удалось загрузить, пробуем локальное хранилище
      if (cleanRootHash) {
        try {
          const fs = require('fs').promises
          const path = require('path')
          const localDir = path.join(process.cwd(), 'data', 'metadata')
          const localPath = path.join(localDir, `${cleanRootHash}.json`)
          
          // Проверяем существование файла
          await fs.access(localPath)
          
          const localContent = await fs.readFile(localPath, 'utf-8')
          console.log('Retrieved from local storage:', cleanRootHash)
          
          return NextResponse.json({
            success: true,
            content: localContent,
            rootHash: cleanRootHash,
            local: true
          })
        } catch (localError) {
          console.log('Not found in local storage either:', cleanRootHash)
        }
      }
      
      // Если у нас есть tokenId, генерируем метаданные на основе него
      const fallbackName = tokenId ? `AI Agent #${tokenId}` : 'Unknown Agent'
      const fallbackModel = tokenId && parseInt(tokenId) % 2 === 0 ? 'deepseek-r1-70b' : 'llama-3.3-70b'
      
      // Возвращаем дефолтные метаданные
      return NextResponse.json({
        success: true,
        content: JSON.stringify({
          name: fallbackName,
          description: 'Metadata not available',
          model: fallbackModel,
          personality: 'friendly',
          skills: ['chat'],
          image: `https://api.dicebear.com/7.x/bottts/svg?seed=${tokenId || 'default'}`,
          error: 'metadata_not_found',
          rootHash: cleanRootHash
        }),
        rootHash: cleanRootHash || 'unknown'
      })
    }
  } catch (error: any) {
    console.error('Retrieve route error:', error)
    
    // В случае любой ошибки возвращаем базовые метаданные
    return NextResponse.json({
      success: true,
      content: JSON.stringify({
        name: 'Unknown Agent',
        description: 'Metadata retrieval failed',
        model: 'llama-3.3-70b',
        personality: 'friendly',
        skills: ['chat'],
        error: 'retrieval_error',
        errorDetails: error.message
      }),
      rootHash: 'error'
    })
  }
}