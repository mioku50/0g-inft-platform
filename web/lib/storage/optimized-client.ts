// web/lib/storage/optimized-client.ts
import { Indexer } from '@0glabs/0g-ts-sdk'
import pLimit from 'p-limit'
import { LRUCache } from 'lru-cache'

// Ограничиваем параллельные запросы
const limit = pLimit(3)

// LRU кеш для метаданных
const storageCache = new LRUCache<string, any>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 час
})

export async function downloadFromStorageCached(rootHash: string): Promise<string> {
  // Проверяем кеш
  const cached = storageCache.get(rootHash)
  if (cached) {
    console.log('Cache hit for:', rootHash)
    return cached
  }
  
  // Загружаем с ограничением
  return limit(async () => {
    const indexer = new Indexer(process.env.NEXT_PUBLIC_0G_STORAGE_URL || '')
    const result = await (indexer as any).download(rootHash, '', false)
    
    // Кешируем результат
    storageCache.set(rootHash, result)
    return result as string
  })
}