'use client'
import { useEffect, useState } from 'react'

export default function ImportCheck() {
  const [out, setOut] = useState('pending...')
  
  useEffect(() => {
    (async () => {
      try {
        console.log('[import-check] Attempting SDK import...')
        const mod = await import('@0glabs/0g-serving-broker')
        console.log('[import-check] Import successful:', mod)
        
        const exports = Object.keys(mod)
        const hasMainExport = 'createZGComputeNetworkBroker' in mod
        
        setOut(`OK: ${exports.join(', ')} (total: ${exports.length}, main: ${hasMainExport})`)
      } catch (e: any) {
        console.error('[import-check] Import failed:', e)
        setOut('ERR: ' + (e?.message || String(e)))
      }
    })()
  }, [])
  
  return (
    <div style={{padding:16}}>
      <h1>SDK Import Test</h1>
      <pre style={{whiteSpace: 'pre-wrap'}}>{out}</pre>
    </div>
  )
}