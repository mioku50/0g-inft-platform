import { NextRequest, NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/storage/client-server'
import fsSync from 'fs'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Accept both 'hash' and 'rootHash'
    let rootHash = body?.hash ?? body?.rootHash
    const { tokenId } = body
    
    // If neither provided or invalid, return soft empty without logs
    if (!rootHash || typeof rootHash !== 'string') {
      return NextResponse.json({ ok: true, content: null })
    }

    // sanitize rootHash, allow both url and bare hash
    let cleanRootHash: any = rootHash
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

    if (!cleanRootHash || typeof cleanRootHash !== 'string') {
      return NextResponse.json({ ok: true, content: null })
    }

    try {
      const content = await downloadFromStorage(cleanRootHash)
      return NextResponse.json({
        ok: true,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        rootHash: cleanRootHash,
      })
    } catch (error: any) {
      const code = error?.code || ''
      // ENOENT or not found → return soft empty
      if (code === 'ENOENT') {
        return NextResponse.json({ ok: true, content: null, rootHash: cleanRootHash })
      }

      // Если не удалось загрузить, пробуем локальное хранилище
      if (cleanRootHash && typeof cleanRootHash === 'string' && cleanRootHash.startsWith('local://')) {
        try {
          const hash = cleanRootHash.replace('local://', '')
          const path = require('path')
          const localDir = path.join(process.cwd(), 'data', 'metadata')
          const localPath = path.join(localDir, `${hash}.json`)
          if (!fsSync.existsSync(localPath)) {
            return NextResponse.json({ ok: true, content: null, rootHash: cleanRootHash })
          }
          const fs = require('fs').promises
          const localContent = await fs.readFile(localPath, 'utf-8')
          return NextResponse.json({ ok: true, content: localContent, rootHash: cleanRootHash })
        } catch {
          // continue to fallback
        }
      } else if (cleanRootHash) {
        try {
          const path = require('path')
          const localDir = path.join(process.cwd(), 'data', 'metadata')
          const localPath = path.join(localDir, `${cleanRootHash}.json`)
          if (!fsSync.existsSync(localPath)) {
            return NextResponse.json({ ok: true, content: null, rootHash: cleanRootHash })
          }
          const fs = require('fs').promises
          const localContent = await fs.readFile(localPath, 'utf-8')

          return NextResponse.json({
            ok: true,
            content: localContent,
            rootHash: cleanRootHash,
          })
        } catch {
          // continue to fallback
        }
      }
      
      // Если у нас есть tokenId, генерируем минимальные метаданные на основе него
      const fallbackName = tokenId ? `AI Agent #${tokenId}` : 'Unknown Agent'
      return NextResponse.json({
        ok: true,
        content: JSON.stringify({ name: fallbackName, description: 'Metadata not available', rootHash: cleanRootHash }),
        rootHash: cleanRootHash || 'unknown',
      })
    }
  } catch {
    // Any parse/body error → soft empty
    return NextResponse.json({ ok: true, content: null })
  }
}
