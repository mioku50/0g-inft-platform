'use client'
import { useEffect, useState } from 'react'

export function useFineTune(wallet: string | null, jobId: string | null) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    if (!jobId || !wallet) return
    let timer: any
    const fetcher = async () => {
      const res = await fetch(`/v1/user/${wallet}/task/${jobId}`)
      const j = await res.json()
      setData(j)
      if (j.status === 'COMPLETED') clearInterval(timer)
    }
    fetcher()
    timer = setInterval(fetcher, 5000)
    return () => clearInterval(timer)
  }, [wallet, jobId])
  return data
}
