'use client'

import { useState } from 'react'
import { loadSdk } from '@/lib/compute/clientBroker'

export default function SDKTestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLoadSDK = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log('[SDK Test] Loading SDK...')
      const mod = await loadSdk()
      
      const result = {
        origin: (mod as any).__origin || 'unknown',
        version: (mod as any).version || 'unknown',
        exports: Object.keys(mod).filter(key => !key.startsWith('_')),
        hasCreateZGComputeNetworkBroker: !!mod.createZGComputeNetworkBroker,
        timestamp: new Date().toISOString()
      }
      
      console.log('[SDK Test] SDK loaded successfully:', result)
      setResult(result)
    } catch (e: any) {
      console.error('[SDK Test] Failed to load SDK:', e)
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            0G SDK Test Page
          </h1>
          
          <div className="space-y-6">
            <div>
              <button
                onClick={handleLoadSDK}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Loading SDK...' : 'Load SDK'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
                <p className="text-red-700 font-mono text-sm">{error}</p>
              </div>
            )}

            {result && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h3 className="text-lg font-medium text-green-800 mb-4">SDK Loaded Successfully</h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium text-gray-700">Origin:</span>
                    <span className="ml-2 text-green-700 font-mono">{result.origin}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Version:</span>
                    <span className="ml-2 text-green-700 font-mono">{result.version}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Has createZGComputeNetworkBroker:</span>
                    <span className={`ml-2 font-mono ${result.hasCreateZGComputeNetworkBroker ? 'text-green-700' : 'text-red-700'}`}>
                      {result.hasCreateZGComputeNetworkBroker ? 'true' : 'false'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Exports:</span>
                    <div className="mt-2 bg-gray-100 rounded p-3">
                      <pre className="text-sm text-gray-800 font-mono">
                        {result.exports.join(', ')}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}