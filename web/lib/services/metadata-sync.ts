// web/lib/services/metadata-sync.ts
import 'dotenv/config'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { uploadToStorage } from '@/lib/storage/client-server'
import fs from 'fs/promises'
import path from 'path'

const METADATA_ROOT = '/data/metadata'
const LOCAL_DIR = path.join(METADATA_ROOT, 'local')

function normalizeRoot(root: string) {
  const fromUrl = root.replace(/^https?:\/\/[^/]+\/(0x[0-9a-fA-F]+)/, '$1')
  return fromUrl.replace(/^local:\/\/+/, 'local/')
}

export class MetadataSyncService {
  private static instance: MetadataSyncService
  private syncInterval: NodeJS.Timeout | null = null
  private retryInterval: NodeJS.Timeout | null = null // Добавили!
  private isSyncing = false
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new MetadataSyncService()
    }
    return this.instance
  }
  
  // Новый метод для одиночного запуска
  async syncOnce() {
    if (this.isSyncing) {
      console.log('[MetadataSync] Already syncing, skipping...')
      return { skipped: true }
    }
    
    return this.syncMissingMetadata()
  }
  
  async syncMissingMetadata() {
    if (this.isSyncing) return { skipped: true }
    this.isSyncing = true
    
    console.log('[MetadataSync] Starting sync...')
    
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
        INFT_ABI,
        provider
      )
      
      const totalSupply = await contract.totalSupply()
      await fs.mkdir(LOCAL_DIR, { recursive: true })
      
      let fixedCount = 0
      let processedCount = 0
      
      // Ограничиваем количество токенов за раз
      const maxTokensPerSync = 50 // Обрабатываем не более 50 токенов за раз
      const tokensToProcess = Math.min(Number(totalSupply), maxTokensPerSync)
      
      for (let i = 0; i < tokensToProcess; i++) {
        try {
          const tokenId = await contract.tokenByIndex(i)
          let metadataHash = await contract.getEncryptedURI(tokenId)
          
          // Очищаем хэш от URL если он есть
          let cleanHash = metadataHash
          if (metadataHash && typeof metadataHash === 'string') {
            if (metadataHash.includes('http://') || metadataHash.includes('https://')) {
              console.warn(`Token #${tokenId} has URL instead of hash:`, metadataHash)
              const parts = metadataHash.split('/')
              cleanHash = parts[parts.length - 1]
              console.log('Extracted hash:', cleanHash)
            }
            
            // Добавляем префикс 0x если нужно
            if (cleanHash && !cleanHash.startsWith('0x')) {
              if (/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
                cleanHash = '0x' + cleanHash
              }
            }
          }
          
          // Проверяем существует ли файл локально
          const filePath = path.join(METADATA_ROOT, `${normalizeRoot(cleanHash)}.json`)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          try {
            await fs.access(filePath)
            console.log(`[MetadataSync] Token #${tokenId} already has local metadata`)
            processedCount++
            continue // Файл существует
          } catch {
            // Файл не существует, пробуем загрузить
          }
          
          // Пробуем загрузить из 0G Storage
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_0G_STORAGE_URL}/api/v0/file/download`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                root: cleanHash.replace('0x', '') // 0G Storage может не любить префикс
              })
            })
            
            if (response.ok) {
              const content = await response.text()
              await fs.mkdir(path.dirname(filePath), { recursive: true })
              await fs.writeFile(filePath, content)
              console.log(`[MetadataSync] Downloaded metadata for token #${tokenId}`)
              fixedCount++
            } else {
              throw new Error('Download failed')
            }
          } catch (downloadError) {
            console.error(`[MetadataSync] Failed to download metadata for token #${tokenId}:`, downloadError)
            
            // Создаем fallback метаданные
            const metadata = {
              name: `AI Agent #${tokenId}`,
              description: 'Intelligent AI assistant powered by advanced language models',
              model: Number(tokenId) % 2 === 0 ? 'deepseek-r1-70b' : 'llama-3.3-70b',
              personality: ['friendly', 'professional', 'creative', 'analytical', 'mentor'][Number(tokenId) % 5],
              systemPrompt: `You are AI Agent #${tokenId}, an intelligent assistant.`,
              skills: ['conversation', 'analysis', 'creative writing'],
              image: `https://api.dicebear.com/7.x/bottts/svg?seed=agent-${tokenId}`,
              createdAt: new Date().toISOString(),
              tokenId: tokenId.toString(),
              autoGenerated: true,
              error: 'original_metadata_not_found'
            }
            
            await fs.mkdir(path.dirname(filePath), { recursive: true })
            await fs.writeFile(filePath, JSON.stringify(metadata, null, 2))
            console.log(`[MetadataSync] Created fallback for token #${tokenId}`)
            fixedCount++
          }
          
          processedCount++
        } catch (error) {
          console.error(`[MetadataSync] Error processing token ${i}:`, error)
        }
      }
      
      console.log(`[MetadataSync] Sync completed. Fixed ${fixedCount} tokens, processed ${processedCount}/${tokensToProcess}`)
      
      return {
        fixed: fixedCount,
        processed: processedCount,
        total: Number(totalSupply)
      }
      
    } catch (error) {
      console.error('[MetadataSync] Sync error:', error)
      return { error: (error as any).message }
    } finally {
      this.isSyncing = false
    }
  }
  
  // УДАЛИТЕ метод startAutoSync или закомментируйте его
  /*
  startAutoSync(intervalMinutes = 5) {
    // НЕ ИСПОЛЬЗУЙТЕ!
  }
  */
  
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval)
      this.retryInterval = null
    }
    console.log('[MetadataSync] All intervals stopped')
  }

  // Сделайте retryFailedUploads приватным или удалите
  private async retryFailedUploads() {
    // Этот метод тоже может быть проблемой
    // Лучше вызывать его явно, а не по интервалу
  }
}