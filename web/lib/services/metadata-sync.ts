// web/lib/services/metadata-sync.ts
import 'dotenv/config'
import { ethers } from 'ethers'
import { INFT_ABI } from '@/lib/contracts/abis'
import { uploadToStorage } from '@/lib/storage/client-server'
import fs from 'fs/promises'
import path from 'path'

const METADATA_ROOT = '/data/metadata'
const LOCAL_DIR = path.join(METADATA_ROOT, 'local')

// Caching and throttling configuration
const SYNC_CACHE_TTL = 30 * 60 * 1000 // 30 minutes
const REQUEST_DELAY = 100 // 100ms between requests
const MAX_TOKENS_PER_SYNC = 30 // Reduced to avoid spam

interface SyncCache {
  lastSyncedAt: number
  lastSyncedBlock: number
  totalSupply: number
}

let syncCache: SyncCache | null = null

function normalizeRoot(root: string) {
  const fromUrl = root.replace(/^https?:\/\/[^/]+\/(0x[0-9a-fA-F]+)/, '$1')
  return fromUrl.replace(/^local:\/\/+/, 'local/')
}

function shouldSkipSync(): boolean {
  if (!syncCache) return false
  
  const now = Date.now()
  const timeSinceLastSync = now - syncCache.lastSyncedAt
  
  if (timeSinceLastSync < SYNC_CACHE_TTL) {
    console.log(`[MetadataSync] Skipping sync - last sync was ${Math.round(timeSinceLastSync / 1000)}s ago (TTL: ${SYNC_CACHE_TTL / 1000}s)`)
    return true
  }
  
  return false
}

export class MetadataSyncService {
  private static instance: MetadataSyncService
  private isSyncing = false
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new MetadataSyncService()
    }
    return this.instance
  }
  
  async syncOnce() {
    if (this.isSyncing) {
      console.log('[MetadataSync] Already syncing, skipping...')
      return { skipped: true, reason: 'already_syncing' }
    }
    
    if (shouldSkipSync()) {
      return { skipped: true, reason: 'cache_ttl', cache: syncCache }
    }
    
    return this.syncMissingMetadata()
  }
  
  async syncMissingMetadata() {
    if (this.isSyncing) return { skipped: true, reason: 'already_syncing' }
    this.isSyncing = true
    
    const startTime = Date.now()
    console.log('[MetadataSync] Starting optimized sync...')
    
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
        INFT_ABI,
        provider
      )
      
      // Get current block for caching
      const currentBlock = await provider.getBlockNumber()
      const totalSupply = await contract.totalSupply()
      const totalSupplyNum = Number(totalSupply)
      
      // Check if we need to sync based on block number
      if (syncCache && syncCache.lastSyncedBlock === currentBlock && syncCache.totalSupply === totalSupplyNum) {
        console.log(`[MetadataSync] No new blocks since last sync (block ${currentBlock})`)
        return { skipped: true, reason: 'no_new_blocks', currentBlock, totalSupply: totalSupplyNum }
      }
      
      await fs.mkdir(LOCAL_DIR, { recursive: true })
      
      let fixedCount = 0
      let processedCount = 0
      let skippedCount = 0
      
      // Process tokens with throttling
      const tokensToProcess = Math.min(totalSupplyNum, MAX_TOKENS_PER_SYNC)
      
      for (let i = 0; i < tokensToProcess; i++) {
        try {
          const tokenId = await contract.tokenByIndex(i)
          let metadataHash = await contract.getEncryptedURI(tokenId)
          
          // Clean hash from URL (without spam logging)
          let cleanHash = this.extractHashFromUri(metadataHash, tokenId)
          
          // Check if file exists locally (quick skip)
          const filePath = path.join(METADATA_ROOT, `${normalizeRoot(cleanHash)}.json`)
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          
          try {
            await fs.access(filePath)
            skippedCount++
            processedCount++
            continue // File exists, skip
          } catch {
            // File doesn't exist, need to download
          }
          
          // Download with throttling
          const success = await this.downloadTokenMetadata(tokenId, cleanHash, filePath)
          if (success) {
            fixedCount++
          }
          
          processedCount++
          
          // Add delay between requests to avoid rate limiting
          if (REQUEST_DELAY > 0 && i < tokensToProcess - 1) {
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY))
          }
          
        } catch (error: any) {
          if (error?.code !== 'ENOENT') {
            console.error(`[MetadataSync] Error processing token ${i}:`, error.message)
          }
        }
      }
      
      // Update cache
      syncCache = {
        lastSyncedAt: Date.now(),
        lastSyncedBlock: currentBlock,
        totalSupply: totalSupplyNum
      }
      
      const duration = Date.now() - startTime
      console.log(`[MetadataSync] Sync completed in ${duration}ms. Fixed: ${fixedCount}, Skipped: ${skippedCount}, Processed: ${processedCount}/${tokensToProcess}`)
      
      return {
        fixed: fixedCount,
        skipped: skippedCount,
        processed: processedCount,
        total: totalSupplyNum,
        duration
      }
      
    } catch (error) {
      console.error('[MetadataSync] Sync error:', error)
      return { error: (error as any).message }
    } finally {
      this.isSyncing = false
    }
  }

  private extractHashFromUri(metadataHash: string, tokenId: any): string {
    let cleanHash = metadataHash
    
    if (metadataHash && typeof metadataHash === 'string') {
      if (metadataHash.includes('http://') || metadataHash.includes('https://')) {
        // Extract hash without logging spam
        const parts = metadataHash.split('/')
        cleanHash = parts[parts.length - 1]
      }
      
      // Add 0x prefix if needed
      if (cleanHash && !cleanHash.startsWith('0x')) {
        if (/^[a-fA-F0-9]{64}$/.test(cleanHash)) {
          cleanHash = '0x' + cleanHash
        }
      }
    }
    
    return cleanHash
  }

  private async downloadTokenMetadata(tokenId: any, cleanHash: string, filePath: string): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_0G_STORAGE_URL}/api/v0/file/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          root: cleanHash.replace('0x', '') // 0G Storage might not like prefix
        })
      })
      
      if (response.ok) {
        const buf = await response.text()
        if (buf) {
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, buf)
          return true
        }
      }
      
      throw new Error('Download failed or empty response')
      
    } catch (downloadError) {
      // Create fallback metadata without logging every failure
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
      return true
    }
  }
  
  // Clean shutdown method
  stopAutoSync() {
    console.log('[MetadataSync] Service stopped')
  }
}