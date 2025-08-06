// web/hooks/useMetadataSync.ts
import { useEffect, useCallback, useRef, useState } from 'react'
import { toast } from '@/components/ui/use-toast'

export function useMetadataSync(enabled = true, intervalMinutes = 5) {
  const [isSyncing, setIsSyncing] = useState(false)
  const syncInProgressRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Check if indexing watcher is enabled
  const isIndexingEnabled = process.env.NEXT_PUBLIC_INDEXING_WATCHER_ENABLED !== 'false'
  const shouldSync = enabled && isIndexingEnabled
  
  const syncMetadata = useCallback(async () => {
    if (!isIndexingEnabled) {
      console.log('[useMetadataSync] Metadata sync disabled via INDEXING_WATCHER_ENABLED=false')
      return
    }
    
    // Предотвращаем множественные вызовы
    if (syncInProgressRef.current) {
      console.log('[useMetadataSync] Sync already in progress, skipping...')
      return
    }
    
    try {
      syncInProgressRef.current = true
      setIsSyncing(true)
      
      // Создаем AbortController для отмены запроса
      abortControllerRef.current = new AbortController()
      
      const response = await fetch('/api/sync/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
        // Добавляем timeout
        body: JSON.stringify({
          mode: 'single' // Важно! Говорим API выполнить только один раз
        })
      })
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('[useMetadataSync] Sync completed:', result)
      
      // Показываем результат пользователю
      if (result.fixed > 0) {
        toast({
          title: 'Metadata synced',
          description: `Fixed ${result.fixed} tokens`,
        })
      }
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[useMetadataSync] Sync aborted')
      } else {
        console.error('[useMetadataSync] Error:', error)
        // Не показываем toast при каждой ошибке, чтобы не спамить
      }
    } finally {
      syncInProgressRef.current = false
      setIsSyncing(false)
      abortControllerRef.current = null
    }
  }, [isIndexingEnabled])
  
  useEffect(() => {
    if (!shouldSync) return
    
    // НЕ синхронизируем при каждом монтировании!
    // Только по интервалу
    let mounted = true
    
    // Первая синхронизация через 10 секунд после монтирования
    const initialTimeout = setTimeout(() => {
      if (mounted && shouldSync) {
        syncMetadata()
      }
    }, 10000)
    
    // Периодическая синхронизация
    const interval = setInterval(() => {
      if (mounted && shouldSync) {
        syncMetadata()
      }
    }, intervalMinutes * 60 * 1000)
    
    return () => {
      mounted = false
      clearTimeout(initialTimeout)
      clearInterval(interval)
      
      // Отменяем активный запрос при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [shouldSync, intervalMinutes, syncMetadata])
  
  return { 
    syncMetadata, 
    isSyncing 
  }
}

// Экспортируем также singleton версию для глобального использования
let globalSyncInterval: NodeJS.Timeout | null = null

export function startGlobalMetadataSync(intervalMinutes = 5) {
  if (globalSyncInterval) {
    console.log('[MetadataSync] Global sync already running')
    return
  }
  
  const sync = async () => {
    try {
      const response = await fetch('/api/sync/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single' })
      })
      console.log('[MetadataSync] Global sync completed')
    } catch (error) {
      console.error('[MetadataSync] Global sync error:', error)
    }
  }
  
  // Запускаем раз в указанный интервал
  globalSyncInterval = setInterval(sync, intervalMinutes * 60 * 1000)
}

export function stopGlobalMetadataSync() {
  if (globalSyncInterval) {
    clearInterval(globalSyncInterval)
    globalSyncInterval = null
    console.log('[MetadataSync] Global sync stopped')
  }
}