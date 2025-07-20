// web/lib/cache/agent-cache.ts
import NodeCache from 'node-cache'

// Кеш на 1 час для данных агентов
const agentCache = new NodeCache({ stdTTL: 3600 })
const metadataCache = new NodeCache({ stdTTL: 3600 })

export const CacheKeys = {
  AGENT_LIST: 'agent_list',
  AGENT_DATA: (id: string) => `agent_${id}`,
  METADATA: (hash: string) => `metadata_${hash}`,
  TOTAL_SUPPLY: 'total_supply'
}

export { agentCache, metadataCache }