// web/app/test-compute/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OGComputeAPI } from '@/lib/compute/base-api'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function TestComputePage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [serviceInfo, setServiceInfo] = useState<any>(null)

  const api = new OGComputeAPI(process.env.NEXT_PUBLIC_0G_COMPUTE_URL)

  const testEndpoints = async () => {
    setLoading(true)
    try {
      // Тестируем endpoints
      const endpointResults = await api.discoverEndpoints()
      setResults(endpointResults)
      
      // Получаем информацию о сервисе
      const info = await api.getServiceInfo()
      if (info) {
        setServiceInfo(info)
      }
      
      // Пробуем получить провайдеров
      const providers = await api.getProviders()
      if (providers) {
        console.log('Providers from base API:', providers)
      }
    } catch (error) {
      console.error('Test failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const testInference = async () => {
    try {
      const result = await api.inference({
        prompt: 'Hello, what is 2+2?',
        model: 'llama-3.3-70b'
      })
      console.log('Inference result:', result)
    } catch (error) {
      console.error('Inference test failed:', error)
    }
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">0G Compute API Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Base URL: {process.env.NEXT_PUBLIC_0G_COMPUTE_URL}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={testEndpoints} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Endpoints'
            )}
          </Button>
          
          <Button onClick={testInference} className="ml-4">
            Test Inference
          </Button>
        </CardContent>
      </Card>

      {serviceInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Service Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(serviceInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-mono">{result.endpoint}</span>
                  <div className="flex items-center gap-2">
                    {result.ok ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      Status: {result.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}