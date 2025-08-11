'use client'
import { useEffect, useState } from 'react'

export default function ImportCheck() {
  const [out, setOut] = useState('pending...')
  const [attempts, setAttempts] = useState(0)
  
  const testImport = async () => {
    try {
      console.log('[import-check] Testing HMR-safe SDK loading...')
      
      // Test our HMR-safe loading function from clientBroker
      const { loadSdk } = await import('@/lib/compute/clientBroker')
      
      console.log('[import-check] Using clientBroker loadSdk function...')
      const mod = await loadSdk()
      
      const exports = Object.keys(mod)
      const hasMainExport = 'createZGComputeNetworkBroker' in mod
      
      setOut(`✅ OK: ${exports.join(', ')} (total: ${exports.length}, main: ${hasMainExport})`)
    } catch (e: any) {
      console.error('[import-check] Import failed:', e)
      setOut(`❌ ERR: ${e?.message || String(e)}`)
    }
  }
  
  const clearCache = async () => {
    try {
      const { clearSdkCache } = await import('@/lib/compute/clientBroker')
      clearSdkCache()
      setOut('Cache cleared. Click "Test Import" to reload.')
    } catch (e: any) {
      setOut(`Error clearing cache: ${e?.message}`)
    }
  }
  
  useEffect(() => {
    testImport()
  }, [])
  
  return (
    <div style={{padding:16}}>
      <h1>SDK Import Test (HMR-Safe)</h1>
      <pre style={{whiteSpace: 'pre-wrap', marginBottom: 16}}>{out}</pre>
      
      <div style={{marginBottom: 16}}>
        <button 
          onClick={() => {
            setAttempts(prev => prev + 1)
            testImport()
          }}
          style={{marginRight: 8, padding: '8px 16px', cursor: 'pointer'}}
        >
          Test Import (Attempt {attempts + 1})
        </button>
        
        <button 
          onClick={clearCache}
          style={{padding: '8px 16px', cursor: 'pointer', backgroundColor: '#ff6b6b', color: 'white'}}
        >
          Clear Cache
        </button>
      </div>
      
      <p style={{fontSize: 12, color: '#666'}}>
        This page tests HMR-safe SDK loading via clientBroker.ts.
        Should work without "Cannot redefine property" errors.
        [Updated to test HMR]
      </p>
    </div>
  )
}