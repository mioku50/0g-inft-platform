// web/hooks/useMetadataSync.ts
import { useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/use-toast'

export function useMetadataSync(enabled = true, intervalMinutes = 5) {
  const syncMetadata = useCallback(async () => {
    try {
      const response = await fetch('/api/sync/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SYNC_SECRET}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Sync failed')
      }
      
      console.log('[useMetadataSync] Sync triggered')
    } catch (error) {
      console.error('[useMetadataSync] Error:', error)
    }
  }, [])
  
  useEffect(() => {
    if (!enabled) return
    
    // Синхронизация при монтировании
    syncMetadata()
    
    // Периодическая синхронизация
    const interval = setInterval(syncMetadata, intervalMinutes * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [enabled, intervalMinutes, syncMetadata])
  
  return { syncMetadata }
}