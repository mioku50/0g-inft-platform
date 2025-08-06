'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Zap,
  Brain,
  MessageCircle
} from 'lucide-react'
import { LedgerBalance } from '@/components/compute/LedgerBalance'

export default function TestInferencePage() {
  const [testMessage, setTestMessage] = useState('Hello, test the 0G inference system!')
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const testCustodialMode = async () => {
    setLoading(true)
    setTestResult(null)
    
    try {
      console.log('[Test] Testing custodial mode (should fail)...')
      
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: testMessage,
          agentMetadata: {
            name: 'Test Agent',
            description: 'Testing inference system'
          }
        })
      })

      const data = await response.json()
      setTestResult({
        type: 'custodial',
        status: response.status,
        success: data.success,
        data
      })

      if (data.success) {
        toast({
          title: "Custodial Test Passed",
          description: "The API responded successfully",
        })
      } else {
        toast({
          title: "Custodial Test Result",
          description: data.message,
          variant: data.error === 'non_custodial_required' ? 'default' : 'destructive'
        })
      }
    } catch (error: any) {
      setTestResult({
        type: 'custodial',
        status: 'error',
        error: error.message
      })
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const testNonCustodialMode = async () => {
    setLoading(true)
    setTestResult(null)
    
    try {
      console.log('[Test] Testing non-custodial mode with prepared request...')
      
      const response = await fetch('/api/compute/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: testMessage,
          agentMetadata: {
            name: 'Test Agent',
            description: 'Testing inference system'
          },
          prepared: true,
          prep: {
            endpoint: 'http://localhost:3000/api/test-echo',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-test-header': 'test-value'
            },
            body: JSON.stringify({
              messages: [
                { role: 'user', content: testMessage }
              ],
              model: 'test-model'
            })
          }
        })
      })

      const data = await response.text()
      setTestResult({
        type: 'non-custodial',
        status: response.status,
        data: data.substring(0, 500) + (data.length > 500 ? '...' : '')
      })

      if (response.ok) {
        toast({
          title: "Non-custodial Test Passed",
          description: "The proxy forwarding worked successfully",
        })
      } else {
        toast({
          title: "Non-custodial Test Result",
          description: `Status: ${response.status}`,
          variant: response.status === 400 ? 'default' : 'destructive'
        })
      }
    } catch (error: any) {
      setTestResult({
        type: 'non-custodial',
        status: 'error',
        error: error.message
      })
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const testProxyDirect = async () => {
    setLoading(true)
    setTestResult(null)
    
    try {
      console.log('[Test] Testing proxy endpoint directly...')
      
      const response = await fetch('/api/compute/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: 'https://httpbin.org/post',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            test: 'data',
            message: testMessage
          })
        })
      })

      const data = await response.text()
      setTestResult({
        type: 'proxy-direct',
        status: response.status,
        data: data.substring(0, 500) + (data.length > 500 ? '...' : '')
      })

      if (response.ok) {
        toast({
          title: "Proxy Test Passed",
          description: "The proxy endpoint works correctly",
        })
      } else {
        toast({
          title: "Proxy Test Result",
          description: `Status: ${response.status}`,
          variant: response.status === 403 ? 'default' : 'destructive'
        })
      }
    } catch (error: any) {
      setTestResult({
        type: 'proxy-direct',
        status: 'error',
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl text-white">
              <Brain className="text-purple-400" />
              0G Inference System Test Dashboard
            </CardTitle>
            <p className="text-purple-200">
              Test the non-custodial inference request flow and proxy functionality
            </p>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Tests */}
          <div className="space-y-6">
            {/* Test Input */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <MessageCircle className="text-blue-400" />
                  Test Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter test message..."
                  className="bg-white/10 border-white/30 text-white placeholder:text-purple-300"
                />
              </CardContent>
            </Card>

            {/* Test Buttons */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Zap className="text-yellow-400" />
                  Inference Tests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={testCustodialMode}
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Test 1: Custodial Mode (Should Require Non-custodial)
                </Button>

                <Button
                  onClick={testNonCustodialMode}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Test 2: Non-custodial Mode (Prepared Request)
                </Button>

                <Button
                  onClick={testProxyDirect}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertCircle className="mr-2 h-4 w-4" />}
                  Test 3: Proxy Security (Should Block External)
                </Button>
              </CardContent>
            </Card>

            {/* Ledger Balance Component Test */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-white">
                  Ledger Balance Component (Compact)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LedgerBalance compact={true} />
                <Separator className="my-4 bg-white/20" />
                <div className="text-sm text-purple-200">
                  ⚠️ This component will show "Connect wallet" when no wallet is connected
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {/* Test Results */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-white">Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                {testResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white">
                        {testResult.type}
                      </Badge>
                      <Badge 
                        variant={testResult.status === 200 ? 'default' : 'destructive'}
                        className={testResult.status === 200 ? 'bg-green-600' : 'bg-red-600'}
                      >
                        Status: {testResult.status}
                      </Badge>
                    </div>
                    
                    <div className="bg-black/30 rounded-lg p-4">
                      <pre className="text-xs text-green-300 whitespace-pre-wrap overflow-x-auto">
                        {typeof testResult.data === 'object' 
                          ? JSON.stringify(testResult.data, null, 2)
                          : testResult.data || testResult.error || 'No data'
                        }
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-purple-300">
                    Click a test button to see results here
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Expected Results Guide */}
            <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-white">Expected Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <Badge className="bg-purple-600 mb-2">Test 1 - Custodial</Badge>
                  <div className="text-purple-200">
                    Should return <code className="bg-black/30 px-1 rounded">error: "non_custodial_required"</code> 
                    since USE_NONCUSTODIAL_INFERENCE=true
                  </div>
                </div>
                
                <div>
                  <Badge className="bg-blue-600 mb-2">Test 2 - Non-custodial</Badge>
                  <div className="text-purple-200">
                    Should show <code className="bg-black/30 px-1 rounded">[CHAT] HIT</code> and 
                    <code className="bg-black/30 px-1 rounded">[PROXY] HIT</code> in console logs
                  </div>
                </div>
                
                <div>
                  <Badge className="bg-green-600 mb-2">Test 3 - Proxy Security</Badge>
                  <div className="text-purple-200">
                    Should return <code className="bg-black/30 px-1 rounded">error: "unauthorized_host"</code> 
                    for security protection
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full Ledger Balance Component */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-white">Full Ledger Balance Component</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto">
              <LedgerBalance />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}