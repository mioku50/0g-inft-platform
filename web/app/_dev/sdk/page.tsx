'use client'

import { useState } from 'react'

export default function DevSdkPage() {
  const [loaded, setLoaded] = useState<boolean>(false)
  const [exportsList, setExportsList] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const onLoad = async () => {
    setError(null)
    setLoaded(false)
    setExportsList([])
    try {
      const { loadSdk } = await import('@/lib/compute/clientBroker')
      const mod = await loadSdk()
      // diagnostics
      // eslint-disable-next-line no-console
      console.log('sdk.origin', (mod as any)?.__origin || 'top-level')
      setLoaded(true)
      setExportsList(Object.keys(mod || {}))
    } catch (e: any) {
      setError(`${e?.name || 'Error'}: ${e?.message || String(e)}`)
      setLoaded(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>SDK Import Diagnostic</h2>
      <button onClick={onLoad} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 6 }}>Load SDK</button>
      <div style={{ marginTop: 16 }}>
        <div>loaded: {loaded ? 'true' : 'false'}</div>
        {exportsList.length > 0 && (
          <div>
            <div>exports:</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(exportsList, null, 2)}</pre>
          </div>
        )}
        {error && (
          <div style={{ color: 'red', marginTop: 8 }}>
            <div>error:</div>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
          </div>
        )}
      </div>
    </div>
  )
}