/**
 * Indexing Status API endpoint
 * GET /api/storage/indexing-status?root=<0x...>
 * Returns indexing status for background watcher as per requirements
 */

import { NextRequest, NextResponse } from 'next/server'
import { getIndexingStatus, getWatcherDebugInfo } from '@/lib/storage/indexing-watcher'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rootHash = searchParams.get('root')
    const debug = searchParams.get('debug') === '1'

    // Debug endpoint for monitoring
    if (debug) {
      return NextResponse.json({
        success: true,
        debug: getWatcherDebugInfo()
      })
    }

    // Validate root hash parameter
    if (!rootHash) {
      return NextResponse.json({
        error: 'Missing root parameter',
        details: 'Please provide root hash as query parameter: ?root=0x...'
      }, { status: 400 })
    }

    // Validate root hash format
    const normalizedRoot = normalizeRootHash(rootHash)
    if (!normalizedRoot) {
      return NextResponse.json({
        error: 'Invalid root hash format',
        details: 'Root hash must be 0x + 64 hex characters, local://hash, or 64 hex characters'
      }, { status: 400 })
    }

    // Get indexing status
    const status = getIndexingStatus(normalizedRoot)
    
    if (!status) {
      // Root hash not being watched - check if it's accessible directly
      const isAccessible = await checkDirectAccess(normalizedRoot)
      
      return NextResponse.json({
        success: true,
        indexed: isAccessible,
        lastCheckAt: Date.now(),
        nextRetryIn: 0,
        attempts: 0,
        status: isAccessible ? 'indexed' : 'unknown',
        message: isAccessible 
          ? 'File is accessible via Turbo indexer'
          : 'File accessibility unknown - not being actively watched'
      })
    }

    // Return status from watcher
    return NextResponse.json({
      success: true,
      indexed: status.indexed,
      lastCheckAt: status.lastCheckAt,
      nextRetryIn: Math.round(status.nextRetryIn / 1000), // Convert to seconds
      attempts: status.attempts,
      status: status.status,
      message: getStatusMessage(status)
    })

  } catch (error: any) {
    console.error('[indexing-status] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Normalize root hash format
 */
function normalizeRootHash(rootHash: string): string | null {
  if (!rootHash) return null

  if (rootHash.startsWith('local://')) {
    const hash = rootHash.replace('local://', '')
    if (hash.match(/^[a-fA-F0-9]{64}$/)) {
      return `0x${hash}`
    }
    return null
  }
  
  if (rootHash.startsWith('0x')) {
    if (rootHash.match(/^0x[a-fA-F0-9]{64}$/)) {
      return rootHash
    }
    return null
  }
  
  if (rootHash.match(/^[a-fA-F0-9]{64}$/)) {
    return `0x${rootHash}`
  }
  
  return null
}

/**
 * Check direct access to Turbo indexer
 */
async function checkDirectAccess(rootHash: string): Promise<boolean> {
  try {
    const turboUrl = process.env.NEXT_PUBLIC_0G_STORAGE_TURBO_URL || 
                     process.env.NEXT_PUBLIC_0G_STORAGE_URL || 
                     'https://indexer-storage-testnet-turbo.0g.ai'
    
    const headUrl = `${turboUrl}/${rootHash}`
    const response = await fetch(headUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    })
    
    return response.ok
  } catch (error) {
    return false
  }
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status: any): string {
  switch (status.status) {
    case 'indexed':
      return 'File is accessible via Turbo indexer'
    case 'pending':
      const retryMinutes = Math.round(status.nextRetryIn / 60000)
      return `File is being indexed. Next check in ${retryMinutes} minute(s). Attempt ${status.attempts}.`
    case 'failed':
      return 'File failed to become accessible after 10 minutes of monitoring'
    default:
      return 'Unknown status'
  }
}