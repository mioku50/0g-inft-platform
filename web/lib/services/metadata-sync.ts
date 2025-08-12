// web/lib/services/metadata-sync.ts
import 'dotenv/config'
import { INFT_ABI } from '@/lib/contracts/abis'
import { uploadToStorage } from '@/lib/storage/client-server'
import { getRateLimitedProvider } from '@/lib/server/rate-limited-provider'
import fs from 'fs/promises'
import path from 'path'

const METADATA_ROOT = '/data/metadata'
const LOCAL_DIR = path.join(METADATA_ROOT, 'local')

// Rate limiting for metadata sync
const BATCH_SIZE = 5 // Process 5 tokens at a time
const BATCH_DELAY = 2000 // 2 seconds between batches
const TOKEN_DELAY = 500 // 500ms between individual token calls

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
    
    console.log('[MetadataSync] Starting rate-limited sync...')
    
    try {
      // Use rate-limited provider
      const provider = await getRateLimitedProvider()
      const ethers = await import('ethers')
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
        INFT_ABI,
        provider
      )
      
      console.log('[MetadataSync] Getting total supply with rate limiting...')
      const totalSupply = await contract.totalSupply()
      await fs.mkdir(LOCAL_DIR, { recursive: true })
      
      let fixedCount = 0
      let processedCount = 0
      
      // Enhanced rate limiting: process in smaller batches
      const maxTokensPerSync = 20 // Reduced from 50 to 20
      const tokensToProcess = Math.min(Number(totalSupply), maxTokensPerSync)
      
      console.log(`[MetadataSync] Processing ${tokensToProcess} tokens in batches of ${BATCH_SIZE}`)
      
      // Process tokens in batches with delays
      for (let batchStart = 0; batchStart < tokensToProcess; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, tokensToProcess)
        const batchTokens = []
        
        console.log(`[MetadataSync] Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1} (tokens ${batchStart}-${batchEnd-1})`)
        
        // Collect token IDs for this batch
        for (let i = batchStart; i < batchEnd; i++) {
          try {
            const tokenId = await contract.tokenByIndex(i)
            batchTokens.push({ index: i, tokenId })
            
            // Add delay between individual calls within batch
            if (i < batchEnd - 1) {
              await new Promise(resolve => setTimeout(resolve, TOKEN_DELAY))
            }
          } catch (error) {
            console.error(`[MetadataSync] Error getting tokenByIndex(${i}):`, error)
          }
        }
        
        // Process tokens in this batch
        for (const { index, tokenId } of batchTokens) {
          try {
            const result = await this.processToken(contract, tokenId, index)
            if (result && result.fixed) fixedCount++
            processedCount++
          } catch (error: any) {
            console.error(`[MetadataSync] Error processing token ${tokenId}:`, error.message)
          }
        }
        
        // Delay between batches (except for the last batch)
        if (batchEnd < tokensToProcess) {
          console.log(`[MetadataSync] Waiting ${BATCH_DELAY}ms before next batch...`)
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
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

  private async processToken(contract: any, tokenId: any, index: number): Promise<{ fixed: boolean; exists?: boolean; downloaded?: boolean; fallback?: boolean; error?: string }> {
    try {
      let metadataHash = await contract.getEncryptedURI(tokenId)
      
      // Clean hash from URL if present
      let cleanHash = metadataHash
      if (metadataHash && typeof metadataHash === 'string') {
        if (metadataHash.includes('http://') || metadataHash.includes('https://')) {
          console.warn(`Token #${tokenId} has URL instead of hash:`, metadataHash)
          const parts = metadataHash.split('/')
          cleanHash = parts[parts.length - 1]
          console.log('Extracted hash:', cleanHash)
        }
        
        // Add 0x prefix if needed
        if (cleanHash && !cleanHash.startsWith('0x')) {
          if (/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
            cleanHash = '0x' + cleanHash
          }
        }
      }
      
      // Check if file exists locally
      const filePath = path.join(METADATA_ROOT, `${normalizeRoot(cleanHash)}.json`)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      
      try {
        await fs.access(filePath)
        console.log(`[MetadataSync] Token #${tokenId} already has local metadata`)
        return { fixed: false, exists: true }
      } catch {
        // File doesn't exist, try to download
      }
      
      // Try to download from 0G Storage
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_0G_STORAGE_URL}/api/v0/file/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            root: cleanHash.replace('0x', '') // 0G Storage might not like 0x prefix
          })
        })
        
        if (response.ok) {
          const buf = await response.text()
          if (!buf) {
            console.warn('[MetadataSync] No data received from storage')
          } else {
            await fs.mkdir(path.dirname(filePath), { recursive: true })
            await fs.writeFile(filePath, buf)
            console.log(`[MetadataSync] Downloaded metadata for token #${tokenId}`)
            return { fixed: true, downloaded: true }
          }
        } else {
          throw new Error('Download failed')
        }
      } catch (downloadError) {
        console.warn(`[MetadataSync] Download failed for token #${tokenId}, creating fallback`)
        
        // Create fallback metadata
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
        return { fixed: true, fallback: true }
      }
    } catch (error: any) {
      console.error(`[MetadataSync] Error processing token ${tokenId}:`, error.message)
      return { fixed: false, error: error.message }
    }
    
    // Default return if no path was taken
    return { fixed: false, error: 'unknown_processing_error' }
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