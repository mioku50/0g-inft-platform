// web/app/api/sync/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/server/provider'
import { MetadataSyncService } from '@/lib/services/metadata-sync'

export const runtime = 'nodejs'

const provider = getProvider()
const withTimeout = <T>(p: Promise<T>, ms = 3000) =>
  Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms))])

export async function POST(request: NextRequest) {
  try {
    // Check if indexing watcher is enabled
    const isIndexingEnabled = process.env.INDEXING_WATCHER_ENABLED !== 'false'
    
    if (!isIndexingEnabled) {
      console.log('[Sync API] Metadata sync disabled via INDEXING_WATCHER_ENABLED=false')
      return NextResponse.json({
        success: true,
        message: 'Metadata sync is disabled',
        disabled: true,
        result: {
          fixed: 0,
          processed: 0,
          total: 0,
          skipped: true,
          reason: 'INDEXING_WATCHER_ENABLED=false'
        }
      })
    }
    
    // Проверяем авторизацию (опционально)
    const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    // Легко проверяем сеть с тайм-аутом
    try {
      const network = await withTimeout(provider.getNetwork(), 3000)
      console.log('[Sync API] network', network.chainId)
    } catch (err) {
      console.warn('[Sync API] getNetwork timeout or error')
    }

    // Получаем параметры из body
    const body = await request.json().catch(() => ({}))
    const mode = body.mode || 'single' // по умолчанию синхронный режим
    
    const syncService: any = MetadataSyncService.getInstance()
    
    // Проверяем режим работы
    if (mode === 'single') {
      // Синхронный режим - ждем завершения
      console.log('[Sync API] Running sync in single mode')
      
      const result: any = await syncService.syncOnce()
      
      return NextResponse.json({
        success: true,
        message: 'Metadata sync completed',
        mode: 'single',
        result: {
          fixed: result.fixed || 0,
          processed: result.processed || 0,
          total: result.total || 0,
          skipped: result.skipped || false,
          error: result.error || null
        }
      })
      
    } else if (mode === 'background') {
      // Асинхронный режим - запускаем в фоне (не рекомендуется)
      console.log('[Sync API] Running sync in background mode')
      
      // Запускаем синхронизацию в фоне
      syncService.syncMissingMetadata()
        .then((result: any) => {
          console.log('[Sync API] Background sync completed:', result)
        })
        .catch((error: any) => {
          console.error('[Sync API] Background sync error:', error)
        })
      
      return NextResponse.json({
        success: true,
        message: 'Metadata sync started in background',
        mode: 'background',
        warning: 'Background mode may cause multiple parallel syncs. Use "single" mode instead.'
      })
      
    } else {
      // Неизвестный режим
      return NextResponse.json({
        success: false,
        error: `Unknown sync mode: ${mode}. Use "single" or "background".`
      }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('[Sync API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to sync metadata',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const syncService = MetadataSyncService.getInstance()
    
    // Возвращаем статус сервиса
    return NextResponse.json({
      message: 'Use POST method to start sync',
      status: {
        isSyncing: syncService['isSyncing'] || false,
        lastSync: (syncService as any)['lastSyncTime'] || null
      },
      usage: {
        method: 'POST',
        body: {
          mode: 'single | background (default: single)'
        },
        example: {
          mode: 'single'
        }
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error.message
    }, { status: 500 })
  }
}

// Добавляем endpoint для остановки синхронизации
export async function DELETE(request: NextRequest) {
  try {
    const syncService = MetadataSyncService.getInstance()
    
    // Останавливаем все интервалы
    syncService.stopAutoSync()
    
    return NextResponse.json({
      success: true,
      message: 'All sync intervals stopped'
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to stop sync'
    }, { status: 500 })
  }
}