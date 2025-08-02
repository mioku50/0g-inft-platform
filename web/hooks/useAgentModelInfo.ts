// hooks/useAgentModelInfo.ts
// Hook to get agent model information (active/candidate status)

'use client'

import { useState, useEffect, useCallback } from 'react'

interface AgentModelInfo {
  hasActiveModel: boolean
  activeModelRoot?: string
  hasCandidate: boolean
  candidateModelRoot?: string
  totalVersions: number
  isTraining: boolean
}

export function useAgentModelInfo(agentId: number): {
  modelInfo: AgentModelInfo | null
  loading: boolean
  error: string | null
  refresh: () => void
} {
  const [modelInfo, setModelInfo] = useState<AgentModelInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchModelInfo = useCallback(async () => {
    if (!agentId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/agents/${agentId}/activate`)
      
      if (!response.ok) {
        // If 404 or other error, assume no model info available
        if (response.status === 404) {
          setModelInfo({
            hasActiveModel: false,
            hasCandidate: false,
            totalVersions: 0,
            isTraining: false
          })
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success) {
        const summary = data.summary || {}
        const onChain = data.onChain || {}

        setModelInfo({
          hasActiveModel: !!summary.activeModel?.modelRootHash || !!onChain.activeModel,
          activeModelRoot: summary.activeModel?.modelRootHash || onChain.activeModel,
          hasCandidate: !!summary.candidateModel?.modelRootHash || !!onChain.candidateModel?.hasCandidate,
          candidateModelRoot: summary.candidateModel?.modelRootHash || onChain.candidateModel?.modelRoot,
          totalVersions: summary.totalVersions || 0,
          isTraining: false // Will be determined by active training tasks
        })
      } else {
        throw new Error(data.error || 'Failed to get model info')
      }

    } catch (err: any) {
      console.warn('Failed to fetch agent model info:', err)
      // Don't show error for model info - just assume no info available
      setModelInfo({
        hasActiveModel: false,
        hasCandidate: false,
        totalVersions: 0,
        isTraining: false
      })
    } finally {
      setLoading(false)
    }
  }, [agentId])

  const refresh = useCallback(() => {
    fetchModelInfo()
  }, [fetchModelInfo])

  useEffect(() => {
    fetchModelInfo()
  }, [fetchModelInfo])

  return {
    modelInfo,
    loading,
    error,
    refresh
  }
}