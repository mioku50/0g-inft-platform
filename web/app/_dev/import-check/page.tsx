'use client'
import { useEffect, useState } from 'react'

export default function ImportCheckPage() {
  const [out, setOut] = useState('pending...')
  
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('@0glabs/0g-serving-broker')
        setOut('OK: ' + Object.keys(mod).join(', '))
      } catch (e: any) {
        setOut('ERR: ' + (e?.message || String(e)))
        console.error('[import-check]', e)
      }
    })()
  }, [])
  
  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <h2>SDK Import Check</h2>
      <pre style={{ 
        background: '#f5f5f5', 
        padding: 12, 
        borderRadius: 4,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {out}
      </pre>
      <p style={{ fontSize: 12, color: '#666', marginTop: 16 }}>
        This page tests direct SDK import. Should show "OK: createZGComputeNetworkBroker, ..." without errors.
      </p>
    </div>
  )
}