// web/app/api/sync/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { MetadataSyncService } from '@/lib/services/metadata-sync'

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию (опционально)
    const authHeader = request.headers.get('authorization')
    // if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }
    
    const syncService = MetadataSyncService.getInstance()
    
    // Запускаем синхронизацию в фоне
    syncService.syncMissingMetadata().catch(console.error)
    
    return NextResponse.json({
      success: true,
      message: 'Metadata sync started'
    })
  } catch (error: any) {
    console.error('Sync API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to start sync'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST method to start sync'
  })
}