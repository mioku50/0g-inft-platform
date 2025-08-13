// components/agents/AgentHeaderServer.tsx
import { headers } from 'next/headers'

type AgentMeta = { name: string; model: string; avatar?: string | null }

interface AgentHeaderServerProps {
  meta: AgentMeta
  tokenId: string
}

export function AgentHeaderServer({ meta, tokenId }: AgentHeaderServerProps) {
  // Safe fallbacks for all properties
  const name = meta?.name || `Agent #${tokenId}`;
  const model = meta?.model || 'AI Assistant';
  
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        {name}
      </h1>
      <p className="text-white/60 text-sm">{model}</p>
    </div>
  )
}

export async function getAgentMeta(id: string): Promise<AgentMeta> {
  try {
    // относительный fetch в app-router работает на сервере
    const res = await fetch(`/agents/metadata/${id}.json`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`meta http ${res.status}`)
    const meta = (await res.json()) as AgentMeta
    return {
      name: meta?.name || `Agent #${id}`,
      model: meta?.model || 'Unknown',
      avatar: meta?.avatar ?? undefined,
    }
  } catch (e) {
    console.warn('[getAgentMeta] fallback:', (e as Error).message)
    return { name: `Agent #${id}`, model: 'Unknown', avatar: undefined }
  }
}