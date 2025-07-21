'use client'
import { useEffect, useState } from 'react'

export function useFineTune(jobId: string | null) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    if (!jobId) return
    let timer: any
    const fetcher = async () => {
      const res = await fetch(`/api/compute/fine-tune?id=${jobId}`)
      const j = await res.json()
      setData(j)
      if (j.status === 'COMPLETED') clearInterval(timer)
    }
    fetcher()
    timer = setInterval(fetcher, 5000)
    return () => clearInterval(timer)
  }, [jobId])
  return data
}
