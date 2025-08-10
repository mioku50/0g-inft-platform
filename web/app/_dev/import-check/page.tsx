'use client'
import { useEffect, useState } from 'react'

export default function ImportCheck() {
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
  return <pre style={{padding:16}}>{out}</pre>
}