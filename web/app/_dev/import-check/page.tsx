"use client"
import { useEffect, useState } from 'react'
import { loadSdk } from '@/lib/compute/clientBroker'

export default function ImportCheckPage() {
  const [info, setInfo] = useState<{ version: string; exports: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const mod: any = await loadSdk()
        const version = mod?.version || process.env.NEXT_PUBLIC_BROKER_SDK_VERSION || 'unknown'
        setInfo({ version, exports: Object.keys(mod) })
      } catch (e: any) {
        setError(e?.message || String(e))
        console.error('[import-check]', e)
      }
    })()
  }, [])

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h2>SDK Import Check</h2>
      {error ? (
        <pre style={{ color: 'red' }}>{error}</pre>
      ) : info ? (
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
          sdkVersion: {info.version}
          {'\n'}exports: {info.exports.join(', ')}
        </pre>
      ) : (
        <pre>loading...</pre>
      )}
      <p style={{ fontSize: 12, color: '#666', marginTop: 16 }}>
        This page tests SDK import via loadSdk().
      </p>
    </div>
  )
}