// web/app/test-metadata/page.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TestMetadataPage() {
  const [rootHash, setRootHash] = useState('0x49065B96...')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testRetrieve = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/storage/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootHash }),
      })
      
      const data = await response.json()
      setResult(data)
      
      if (data.content) {
        try {
          const parsed = JSON.parse(data.content)
          setResult({ ...data, parsed })
        } catch (e) {
          console.error('Failed to parse content:', e)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      setResult({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Test Metadata Retrieval</h1>
      
      <div className="space-y-4 max-w-2xl">
        <div>
          <label>Root Hash:</label>
          <Input
            value={rootHash}
            onChange={(e) => setRootHash(e.target.value)}
            placeholder="Enter root hash"
          />
        </div>
        
        <Button onClick={testRetrieve} disabled={loading}>
          {loading ? 'Loading...' : 'Test Retrieve'}
        </Button>
        
        {result && (
          <div className="mt-4">
            <h2 className="font-bold mb-2">Result:</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}