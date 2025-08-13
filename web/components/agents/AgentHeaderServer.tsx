// components/agents/AgentHeaderServer.tsx
import { downloadFromStorage } from '@/lib/storage/client-server'

interface AgentMeta {
  name: string
  model: string
  description?: string
  avatar?: string
  error?: string
}

interface AgentHeaderServerProps {
  meta: AgentMeta
  tokenId: string
}

export function AgentHeaderServer({ meta, tokenId }: AgentHeaderServerProps) {
  // Safe fallbacks for all properties
  const name = meta?.name || `Agent #${tokenId}`;
  const model = meta?.model || 'AI Assistant';
  const description = meta?.description;
  const error = meta?.error;
  
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        {name}
      </h1>
      <p className="text-white/60 text-sm">{model}</p>
      {description && (
        <p className="text-white/40 text-xs mt-1">{description}</p>
      )}
      {error && (
        <p className="text-red-400/60 text-xs mt-1">⚠️ {error}</p>
      )}
    </div>
  )
}

/**
 * Server-side function to get agent metadata
 * Always returns a safe fallback to prevent UI crashes
 */
export async function getAgentMeta(tokenId: string): Promise<AgentMeta> {
  try {
    // Try to get metadata from storage API
    const response = await fetch(`${process.env.NEXT_PUBLIC_RPC_URL}/api/storage/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tokenId: tokenId,
        // Try common fallback patterns
        rootHash: `local://${tokenId}` 
      }),
    })
    
    if (response.ok) {
      const data = await response.json()
      const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
      
      // Safe property access with fallbacks
      if (metadata && typeof metadata === 'object') {
        return {
          name: metadata.name || `Agent #${tokenId}`,
          model: metadata.model || 'AI Assistant',
          description: metadata.description || undefined,
          avatar: metadata.avatar || undefined
        }
      }
    }
    
    // Fallback: try direct storage download
    const metadataContent = await downloadFromStorage(`local://${tokenId}`)
    if (metadataContent && typeof metadataContent === 'string') {
      const metadata = JSON.parse(metadataContent)
      // Safe property access with fallbacks
      if (metadata && typeof metadata === 'object') {
        return {
          name: metadata.name || `Agent #${tokenId}`,
          model: metadata.model || 'AI Assistant', 
          description: metadata.description || undefined,
          avatar: metadata.avatar || undefined
        }
      }
    }
    
    // Fallback to basic agent info
    return {
      name: `Agent #${tokenId}`,
      model: 'AI Assistant',
      description: 'Metadata not available',
      error: 'metadata_not_found'
    }
    
  } catch (error) {
    console.warn(`[getAgentMeta] Failed to load metadata for agent ${tokenId}:`, error)
    
    // Always return safe fallback - never throw or return undefined
    return {
      name: `Agent #${tokenId}`,
      model: 'AI Assistant',
      description: 'Unable to load agent details',
      error: 'load_failed'
    }
  }
}