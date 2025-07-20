import { NextRequest, NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

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

    // sanitize rootHash, allow both url and bare hash
    let cleanRootHash = rootHash
    if (rootHash && typeof rootHash === 'string') {
      if (rootHash.includes('http://') || rootHash.includes('https://')) {
        const parts = rootHash.split('/')
        cleanRootHash = parts[parts.length - 1]
      }

      if (cleanRootHash && !cleanRootHash.startsWith('0x')) {
        if (/^[a-fA-F0-9]{64}$/.test(cleanRootHash)) {
          cleanRootHash = '0x' + cleanRootHash
        }
      }
    }

    console.log('Retrieving data for root hash:', cleanRootHash)

    try {
      const content = await downloadFromStorage(cleanRootHash)
      return NextResponse.json({
        success: true,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        rootHash: cleanRootHash,
      })
    } catch (error: any) {
      console.error('Storage retrieval error:', error)

      // Если не удалось загрузить, пробуем локальное хранилище
      if (cleanRootHash.startsWith('local://')) {
        try {
          const hash = cleanRootHash.replace('local://', '')
          const fs = require('fs').promises
          const path = require('path')
          const localDir = path.join(process.cwd(), 'data', 'metadata')
          const localPath = path.join(localDir, `${hash}.json`)
          const localContent = await fs.readFile(localPath, 'utf-8')
          return NextResponse.json({ success: true, content: localContent, rootHash: cleanRootHash, local: true })
        } catch {
          // continue to fallback
        }
      } else if (cleanRootHash) {
        try {
          const fs = require('fs').promises
          const path = require('path')
          const localDir = path.join(process.cwd(), 'data', 'metadata')
          const localPath = path.join(localDir, `${cleanRootHash}.json`)

          await fs.access(localPath)
          const localContent = await fs.readFile(localPath, 'utf-8')

          return NextResponse.json({
            success: true,
            content: localContent,
            rootHash: cleanRootHash,
            local: true,
          })
        } catch {
          // continue to fallback
        }
      }
      
      // Если у нас есть tokenId, генерируем метаданные на основе него
      const fallbackName = tokenId ? `AI Agent #${tokenId}` : 'Unknown Agent'
      const fallbackModel = tokenId && parseInt(tokenId) % 2 === 0 ? 'deepseek-r1-70b' : 'llama-3.3-70b'

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
          rootHash: cleanRootHash,
        }),
        rootHash: cleanRootHash || 'unknown',
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
