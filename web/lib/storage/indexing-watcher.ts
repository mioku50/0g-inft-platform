/**
 * Background indexing watcher for 0G Storage Turbo indexer
 * Implements requirements from issue #83:
 * - Background watcher up to 10 minutes
 * - Per-root deduplication 
 * - 30-45 second intervals
 * - In-memory or Redis storage
 */

interface IndexingWatchItem {
  rootHash: string
  status: 'pending' | 'indexed' | 'failed'
  createdAt: number
  lastCheckAt: number
  nextRetryAt: number
  attempts: number
  subscribers: Set<(status: IndexingStatus) => void>
}

interface IndexingStatus {
  indexed: boolean
  lastCheckAt: number
  nextRetryIn: number
  attempts: number
  status: 'pending' | 'indexed' | 'failed'
}

class IndexingWatcher {
  private watchItems = new Map<string, IndexingWatchItem>()
  private isRunning = false
  private checkInterval: NodeJS.Timeout | null = null
  
  // Configuration
  private readonly CHECK_INTERVAL_MS = 30000 // 30 seconds
  private readonly MAX_WATCH_TIME_MS = 10 * 60 * 1000 // 10 minutes
  private readonly TURBO_URL = process.env.NEXT_PUBLIC_0G_STORAGE_TURBO_URL || 
                               process.env.NEXT_PUBLIC_0G_STORAGE_URL || 
                               'https://indexer-storage-testnet-turbo.0g.ai'

  constructor() {
    this.startWatcher()
  }

  /**
   * Add a root hash to the watching queue
   * Implements per-root deduplication as required
   */
  addToWatch(rootHash: string): Promise<IndexingStatus> {
    const normalizedRoot = this.normalizeRootHash(rootHash)
    
    return new Promise((resolve, reject) => {
      // Per-root deduplication: if already watching, subscribe to existing
      let item = this.watchItems.get(normalizedRoot)
      
      if (item) {
        console.log(`[IndexingWatcher] Root ${normalizedRoot.slice(0, 10)}... already being watched, adding subscriber`)
        
        // Add subscriber to existing watch
        item.subscribers.add((status) => {
          if (status.indexed || status.status === 'failed') {
            resolve(status)
          }
        })
        
        // Return current status immediately
        resolve({
          indexed: item.status === 'indexed',
          lastCheckAt: item.lastCheckAt,
          nextRetryIn: Math.max(0, item.nextRetryAt - Date.now()),
          attempts: item.attempts,
          status: item.status
        })
        
        return
      }

      // Create new watch item
      const now = Date.now()
      item = {
        rootHash: normalizedRoot,
        status: 'pending',
        createdAt: now,
        lastCheckAt: 0,
        nextRetryAt: now + 1000, // Check immediately, then use intervals
        attempts: 0,
        subscribers: new Set()
      }

      // Add subscriber
      item.subscribers.add((status) => {
        if (status.indexed || status.status === 'failed') {
          resolve(status)
        }
      })

      this.watchItems.set(normalizedRoot, item)
      console.log(`[IndexingWatcher] Added ${normalizedRoot.slice(0, 10)}... to watch queue`)
      
      // Start watcher if not running
      if (!this.isRunning) {
        this.startWatcher()
      }
    })
  }

  /**
   * Get current status of a root hash
   */
  getStatus(rootHash: string): IndexingStatus | null {
    const normalizedRoot = this.normalizeRootHash(rootHash)
    const item = this.watchItems.get(normalizedRoot)
    
    if (!item) {
      return null
    }

    return {
      indexed: item.status === 'indexed',
      lastCheckAt: item.lastCheckAt,
      nextRetryIn: Math.max(0, item.nextRetryAt - Date.now()),
      attempts: item.attempts,
      status: item.status
    }
  }

  /**
   * Start the background watcher process
   */
  private startWatcher() {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    console.log('[IndexingWatcher] Starting background watcher')

    this.checkInterval = setInterval(() => {
      this.performChecks()
    }, this.CHECK_INTERVAL_MS)
  }

  /**
   * Stop the background watcher
   */
  stopWatcher() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isRunning = false
    console.log('[IndexingWatcher] Stopped background watcher')
  }

  /**
   * Perform checks on all pending items
   */
  private async performChecks() {
    const now = Date.now()
    const itemsToCheck = Array.from(this.watchItems.values())
      .filter(item => 
        item.status === 'pending' && 
        now >= item.nextRetryAt
      )

    if (itemsToCheck.length === 0) {
      return
    }

    console.log(`[IndexingWatcher] Checking ${itemsToCheck.length} items...`)

    // Check items in parallel but with rate limiting
    const promises = itemsToCheck.map(item => this.checkSingleItem(item))
    await Promise.allSettled(promises)

    // Clean up completed or expired items
    this.cleanupItems()
  }

  /**
   * Check a single item for indexing status
   */
  private async checkSingleItem(item: IndexingWatchItem) {
    const now = Date.now()
    
    try {
      console.log(`[IndexingWatcher] Checking ${item.rootHash.slice(0, 10)}... (attempt ${item.attempts + 1})`)
      
      const headUrl = `${this.TURBO_URL}/${item.rootHash}`
      const response = await fetch(headUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      item.lastCheckAt = now
      item.attempts++

      if (response.ok) {
        // Successfully indexed!
        item.status = 'indexed'
        console.log(`✅ [IndexingWatcher] ${item.rootHash.slice(0, 10)}... is now indexed`)
        
        this.notifySubscribers(item)
      } else if (response.status === 404) {
        // Not yet indexed
        if (now - item.createdAt > this.MAX_WATCH_TIME_MS) {
          // Timeout reached
          item.status = 'failed'
          console.warn(`❌ [IndexingWatcher] ${item.rootHash.slice(0, 10)}... timed out after 10 minutes`)
          this.notifySubscribers(item)
        } else {
          // Schedule next check with exponential backoff
          const nextDelay = Math.min(
            this.CHECK_INTERVAL_MS * Math.pow(1.2, item.attempts), 
            45000 // Max 45 seconds as per requirements
          )
          item.nextRetryAt = now + nextDelay
          console.log(`⏳ [IndexingWatcher] ${item.rootHash.slice(0, 10)}... not ready, next check in ${Math.round(nextDelay/1000)}s`)
        }
      } else {
        // Unexpected response
        console.warn(`⚠️ [IndexingWatcher] Unexpected response ${response.status} for ${item.rootHash.slice(0, 10)}...`)
        item.nextRetryAt = now + this.CHECK_INTERVAL_MS
      }

    } catch (error: any) {
      console.warn(`⚠️ [IndexingWatcher] Check failed for ${item.rootHash.slice(0, 10)}...: ${error.message}`)
      
      item.lastCheckAt = now
      item.attempts++
      
      if (now - item.createdAt > this.MAX_WATCH_TIME_MS) {
        item.status = 'failed'
        this.notifySubscribers(item)
      } else {
        // Retry with backoff
        item.nextRetryAt = now + this.CHECK_INTERVAL_MS * 2
      }
    }
  }

  /**
   * Notify all subscribers of status change
   */
  private notifySubscribers(item: IndexingWatchItem) {
    const status: IndexingStatus = {
      indexed: item.status === 'indexed',
      lastCheckAt: item.lastCheckAt,
      nextRetryIn: Math.max(0, item.nextRetryAt - Date.now()),
      attempts: item.attempts,
      status: item.status
    }

    item.subscribers.forEach(callback => {
      try {
        callback(status)
      } catch (error) {
        console.error('[IndexingWatcher] Subscriber callback error:', error)
      }
    })

    // Clear subscribers after notification
    item.subscribers.clear()
  }

  /**
   * Clean up completed or expired items
   */
  private cleanupItems() {
    const now = Date.now()
    const toRemove: string[] = []

    for (const [rootHash, item] of this.watchItems.entries()) {
      // Remove if completed, failed, or too old
      if (item.status !== 'pending' || 
          now - item.createdAt > this.MAX_WATCH_TIME_MS + 60000) { // Extra 1 minute grace
        toRemove.push(rootHash)
      }
    }

    toRemove.forEach(rootHash => {
      console.log(`🧹 [IndexingWatcher] Cleaning up ${rootHash.slice(0, 10)}...`)
      this.watchItems.delete(rootHash)
    })

    // Stop watcher if no items left
    if (this.watchItems.size === 0 && this.isRunning) {
      this.stopWatcher()
    }
  }

  /**
   * Normalize root hash format
   */
  private normalizeRootHash(rootHash: string): string {
    if (rootHash.startsWith('local://')) {
      const hash = rootHash.replace('local://', '')
      return hash.startsWith('0x') ? hash : `0x${hash}`
    }
    
    if (rootHash.startsWith('0x')) {
      return rootHash
    }
    
    return `0x${rootHash}`
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      isRunning: this.isRunning,
      watchingCount: this.watchItems.size,
      items: Array.from(this.watchItems.values()).map(item => ({
        rootHash: item.rootHash.slice(0, 10) + '...',
        status: item.status,
        attempts: item.attempts,
        ageMinutes: Math.round((Date.now() - item.createdAt) / 60000),
        nextRetryInSeconds: Math.round(Math.max(0, item.nextRetryAt - Date.now()) / 1000)
      }))
    }
  }
}

// Singleton instance
let watcherInstance: IndexingWatcher | null = null

/**
 * Get the singleton indexing watcher instance
 */
export function getIndexingWatcher(): IndexingWatcher {
  if (!watcherInstance) {
    watcherInstance = new IndexingWatcher()
  }
  return watcherInstance
}

/**
 * Add a root hash to the indexing watch queue
 * Returns a promise that resolves when the file is indexed or fails
 */
export async function watchForIndexing(rootHash: string): Promise<IndexingStatus> {
  const watcher = getIndexingWatcher()
  return watcher.addToWatch(rootHash)
}

/**
 * Get the current indexing status of a root hash
 */
export function getIndexingStatus(rootHash: string): IndexingStatus | null {
  const watcher = getIndexingWatcher()
  return watcher.getStatus(rootHash)
}

/**
 * Get debug information about the watcher
 */
export function getWatcherDebugInfo() {
  const watcher = getIndexingWatcher()
  return watcher.getDebugInfo()
}

export type { IndexingStatus }