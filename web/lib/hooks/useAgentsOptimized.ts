// lib/hooks/useAgentsOptimized.ts
import { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { INFT_ABI } from '@/lib/contracts/abis'

const CACHE_KEY = 'agents_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

export function useAgentsOptimized() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFromCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}_${address}`)
      if (cached) {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_DURATION) {
          setAgents(data)
          setLoading(false)
          return true
        }
      }
    } catch (e) {
      console.error('Cache error:', e)
    }
    return false
  }, [address])

  const saveToCache = useCallback((data: any[]) => {
    try {
      localStorage.setItem(`${CACHE_KEY}_${address}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.error('Cache save error:', e)
    }
  }, [address])

  const loadAgents = useCallback(async (forceRefresh = false) => {
    if (!address || !publicClient) return

    // Попробуем загрузить из кеша
    if (!forceRefresh && loadFromCache()) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Используем API endpoint для оптимизированной загрузки
      const response = await fetch(`/api/agents/list?owner=${address}`)
      if (!response.ok) throw new Error('Failed to fetch agents')
      
      const data = await response.json()
      setAgents(data.agents || [])
      saveToCache(data.agents || [])
    } catch (err) {
      console.error('Load agents error:', err)
      setError('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [address, publicClient, loadFromCache, saveToCache])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  return {
    agents,
    loading,
    error,
    refresh: () => loadAgents(true)
  }
}