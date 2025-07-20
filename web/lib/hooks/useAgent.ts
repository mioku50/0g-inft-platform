// web/lib/hooks/useAgent.ts
import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { INFT_ABI } from '@/lib/contracts/abis'

interface AgentMetadata {
  name: string
  description: string
  model: string
  personality?: string
  systemPrompt?: string
  expertise?: string
  skills?: string[]
  image?: string
  createdAt?: string
  creator?: string
  error?: string
}

interface Agent {
  tokenId: string
  owner: string
  metadataHash: string
  metadata?: AgentMetadata
  loading: boolean
  error?: string
}

// Fallback metadata based on tokenId and model
function generateFallbackMetadata(tokenId: string): AgentMetadata {
  const models = ['llama-3.3-70b', 'deepseek-r1-70b']
  const personalities = ['friendly', 'professional', 'creative', 'analytical', 'mentor']
  
  // Use tokenId to generate consistent but varied metadata
  const modelIndex = parseInt(tokenId) % models.length
  const personalityIndex = parseInt(tokenId) % personalities.length
  
  return {
    name: `AI Agent #${tokenId}`,
    description: `An intelligent AI assistant powered by advanced language models`,
    model: models[modelIndex],
    personality: personalities[personalityIndex],
    expertise: 'General AI Assistant',
    skills: ['conversation', 'analysis', 'creative writing'],
    image: `https://api.dicebear.com/7.x/bottts/svg?seed=agent-${tokenId}`,
    createdAt: new Date().toISOString(),
    error: 'metadata_fallback'
  }
}

export function useAgent(tokenId: string | undefined) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const publicClient = usePublicClient()
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  useEffect(() => {
    if (!tokenId || !publicClient) {
      setLoading(false)
      return
    }

    const fetchAgent = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get token owner
        const owner = await publicClient.readContract({
          address: contractAddress,
          abi: INFT_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)]
        }) as string

        // Try to get metadata hash
        let metadataHash = ''
        try {
          // First try getMetadataHash if available
          metadataHash = await publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'getMetadataHash',
            args: [BigInt(tokenId)]
          }) as string
        } catch {
          // Fallback to getEncryptedURI
          try {
            metadataHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getEncryptedURI',
              args: [BigInt(tokenId)]
            }) as string
          } catch (e) {
            console.warn('Could not get metadata hash:', e)
          }
        }

        // Create base agent object
        const baseAgent: Agent = {
          tokenId,
          owner,
          metadataHash: metadataHash || '0x',
          loading: false
        }

        // Try to fetch metadata if we have a hash
        if (metadataHash && metadataHash !== '0x' && metadataHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          try {
            const response = await fetch('/api/storage/retrieve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rootHash: metadataHash })
            })

            if (response.ok) {
              const { content } = await response.json()
              const metadata = typeof content === 'string' ? JSON.parse(content) : content
              
              // Validate metadata has required fields
              if (metadata && metadata.name) {
                baseAgent.metadata = metadata
              } else {
                // Use fallback if metadata is incomplete
                baseAgent.metadata = {
                  ...generateFallbackMetadata(tokenId),
                  ...metadata // Merge any partial data
                }
              }
            } else {
              // Use fallback metadata
              baseAgent.metadata = generateFallbackMetadata(tokenId)
            }
          } catch (err) {
            console.error('Error fetching metadata:', err)
            // Use fallback metadata
            baseAgent.metadata = generateFallbackMetadata(tokenId)
          }
        } else {
          // No metadata hash, use fallback
          baseAgent.metadata = generateFallbackMetadata(tokenId)
        }

        setAgent(baseAgent)
      } catch (err: any) {
        console.error('Error fetching agent:', err)
        setError(err.message || 'Failed to fetch agent')
        
        // Even on error, try to provide some data
        if (tokenId) {
          setAgent({
            tokenId,
            owner: '0x0000000000000000000000000000000000000000',
            metadataHash: '0x',
            metadata: generateFallbackMetadata(tokenId),
            loading: false,
            error: err.message
          })
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAgent()
  }, [tokenId, publicClient, contractAddress])

  return { agent, loading, error }
}

// Additional hook to get agent by owner
export function useAgentsByOwner(owner: string | undefined) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const publicClient = usePublicClient()
  const contractAddress = process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS as `0x${string}`

  useEffect(() => {
    if (!owner || !publicClient) {
      setLoading(false)
      return
    }

    const fetchAgents = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get balance
        const balance = await publicClient.readContract({
          address: contractAddress,
          abi: INFT_ABI,
          functionName: 'balanceOf',
          args: [owner as `0x${string}`]
        }) as bigint

        const agentPromises = []
        for (let i = 0; i < Number(balance); i++) {
          const tokenIdPromise = publicClient.readContract({
            address: contractAddress,
            abi: INFT_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [owner as `0x${string}`, BigInt(i)]
          })
          agentPromises.push(tokenIdPromise)
        }

        const tokenIds = await Promise.all(agentPromises)
        
        // Fetch metadata for each token
        const agentsData: Agent[] = []
        for (const tokenId of tokenIds) {
          const id = tokenId.toString()
          
          // Get metadata hash
          let metadataHash = '0x'
          try {
            metadataHash = await publicClient.readContract({
              address: contractAddress,
              abi: INFT_ABI,
              functionName: 'getEncryptedURI',
              args: [tokenId]
            }) as string
          } catch {
            console.warn(`No metadata hash for token ${id}`)
          }

          // Always provide agent data, even without metadata
          const agent: Agent = {
            tokenId: id,
            owner,
            metadataHash,
            metadata: generateFallbackMetadata(id),
            loading: false
          }

          // Try to fetch real metadata
          if (metadataHash && metadataHash !== '0x') {
            try {
              const response = await fetch('/api/storage/retrieve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootHash: metadataHash })
              })

              if (response.ok) {
                const { content } = await response.json()
                const metadata = typeof content === 'string' ? JSON.parse(content) : content
                if (metadata && metadata.name) {
                  agent.metadata = metadata
                }
              }
            } catch (err) {
              console.error(`Error fetching metadata for token ${id}:`, err)
            }
          }

          agentsData.push(agent)
        }

        setAgents(agentsData)
      } catch (err: any) {
        console.error('Error fetching agents:', err)
        setError(err.message || 'Failed to fetch agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [owner, publicClient, contractAddress])

  return { agents, loading, error }
}