import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, BarChart, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccount, useWalletClient } from 'wagmi'

interface PromptManagerProps {
  agent: any
  isOpen: boolean
  onClose: () => void
  onUpdate: (newPrompt: string) => void
}

export function PromptManager({ agent, isOpen, onClose, onUpdate }: PromptManagerProps) {
  const [currentPrompt, setCurrentPrompt] = useState(agent?.metadata?.systemPrompt || '')
  const [activeTab, setActiveTab] = useState<'current' | 'generate' | 'analysis'>('current')
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  
  const [description, setDescription] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [personality, setPersonality] = useState('')
  const [maxTokens, setMaxTokens] = useState<number>(256)

  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const tokenId: number | undefined = typeof agent?.tokenId !== 'undefined' ? Number(agent.tokenId) : (typeof agent?.id !== 'undefined' ? Number(agent.id) : undefined)
  // Load current prompt from server on open
  useEffect(() => {
    let cancelled = false
    async function loadCurrentPrompt() {
      if (!isOpen || !tokenId) return
      try {
        const res = await fetch(`/api/prompt?tokenId=${tokenId}`)
        const data = await res.json()
        if (!cancelled && data) {
          if (typeof data.prompt === 'string') setCurrentPrompt(data.prompt)
          if (typeof data.updatedAt === 'number') setLastUpdated(data.updatedAt)
        }
      } catch {}
      
      // If empty, fallback to NFT metadata systemPrompt or build one from metadata
      try {
        if (!cancelled && (!currentPrompt || currentPrompt.trim().length === 0)) {
          const rootHash = agent?.metadataHash
          if (!rootHash) {
            // Build from provided agent metadata directly
            try {
              const mod = await import('@/lib/prompts/buildSystemPrompt')
              const metadata = agent?.metadata || {}
              const sysBuilt = mod.buildSystemPrompt({
                name: metadata?.name,
                description: metadata?.description,
                capabilities: Array.isArray(metadata?.capabilities) ? metadata.capabilities : [],
                traits: Array.isArray(metadata?.traits) ? metadata.traits : [],
                skills: Array.isArray(metadata?.skills) ? metadata.skills : [],
                personality: metadata?.personality,
              })
              if (sysBuilt && !cancelled) setCurrentPrompt(sysBuilt)
            } catch {}
            return
          }
          const resp = await fetch('/api/storage/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rootHash, tokenId: String(tokenId) })
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data?.content) {
              const metadata = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
              let sys = metadata?.systemPrompt || ''
              if ((!sys || sys.trim().length === 0)) {
                try {
                  const mod = await import('@/lib/prompts/buildSystemPrompt')
                  sys = mod.buildSystemPrompt({
                    name: metadata?.name,
                    description: metadata?.description,
                    capabilities: Array.isArray(metadata?.capabilities) ? metadata.capabilities : [],
                    traits: Array.isArray(metadata?.traits) ? metadata.traits : [],
                    skills: Array.isArray(metadata?.skills) ? metadata.skills : [],
                    personality: metadata?.personality,
                  })
                } catch {}
              }
              if (sys && !cancelled) setCurrentPrompt(sys)
            }
          }
        }
      } catch {}
    }
    loadCurrentPrompt()
    return () => { cancelled = true }
  }, [isOpen, tokenId])

  function randomHex(byteLength: number): string {
    const buf = new Uint8Array(byteLength)
    crypto.getRandomValues(buf)
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function buildMessage(action: 'generate' | 'analyze'): string {
    const nonce = randomHex(16)
    const ts = new Date().toISOString()
    return `OG INFT — authorize compute action\nAgent: #${tokenId ?? 'unknown'}\nAction: ${action} prompt\nNonce: ${nonce}\nTimestamp: ${ts}`
  }

  const analyzePrompt = async () => {
    setIsAnalyzing(true)
    try {
      if (!address || !walletClient || !tokenId) {
        toast({ title: 'Wallet required', description: 'Connect wallet and select valid agent.' })
        return
      }
      const message = buildMessage('analyze')
      const signature = await walletClient.signMessage({ account: address as `0x${string}`, message })
      const response = await fetch('/api/compute/analyze-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: currentPrompt,
          tokenId,
          address,
          message,
          signature,
        })
      })
      
      const result = await response.json()
      if (response.ok && result && typeof result === 'object') {
        // Expected shape: { scores: {clarity, constraints, safety}, tips: string[], risks: string[] }
        setAnalysis(result)
        setActiveTab('analysis')
        toast({ title: 'Analysis ready', description: 'Prompt insights generated.' })
      } else {
        const reason = result?.reason ? ` (${result.reason})` : ''
        toast({ title: 'Analysis failed', description: (result?.error ? `${result.error}${reason}` : 'Please try again later.') })
      }
    } catch (error) {
      toast({ title: 'Analysis error', description: (error as any)?.message || 'Unknown error' })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generatePrompt = async () => {
    setIsGenerating(true)
    try {
      if (!address || !walletClient || !tokenId) {
        toast({ title: 'Wallet required', description: 'Connect wallet and select valid agent.' })
        return
      }
      const message = buildMessage('generate')
      // Awaiting signature UI state reflected by isGenerating + button label
      const signature = await walletClient.signMessage({ account: address as `0x${string}`, message })
      const response = await fetch('/api/compute/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          capabilities,
          personality,
          traits: personality,
          tokenId,
          address,
          message,
          signature,
          maxTokens,
        })
      })
      
      const result = await response.json()
      if (response.ok && result?.prompt) {
        // Save prompt via API
        if (tokenId) {
          try {
            const saveRes = await fetch('/api/prompt', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tokenId, prompt: result.prompt })
            })
            const saveData = await saveRes.json()
            if (saveRes.ok && saveData?.ok) {
              setLastUpdated(saveData.updatedAt || Date.now())
              toast({ title: 'Saved', description: 'Prompt has been updated.' })
            } else {
              toast({ title: 'Save failed', description: saveData?.error || 'Unknown error' })
            }
          } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message || 'Unknown error' })
          }
        }
        setCurrentPrompt(result.prompt)
        setActiveProvider(result.provider || null)
        setActiveModel(result.model || null)
        setAnalysis(null)
        setActiveTab('current')
        toast({ title: 'Prompt generated', description: 'Current Prompt updated.' })
      } else {
        // Insufficient balance UX messages
        const reasons = Array.isArray(result?.reasons) ? result.reasons : []
        const insufficientFirstTry = result?.error === 'insufficient_balance'
        const retried = reasons.some((r: any) => r?.code === 'insufficient_balance')
        if (insufficientFirstTry) {
          // Backend already tried to top up and possibly retried
          if (retried) {
            toast({ title: 'Auto top-up & retry…', description: 'Попытка автопополнения и повторного запроса.' })
          }
          const first = reasons[0]
          const detail = first?.message ? `: ${first.message}` : ''
          toast({ title: 'Generation failed', description: `insufficient_balance${detail}` })
        } else {
          let reasonText = result?.reason ? ` (${result.reason})` : ''
          if (Array.isArray(reasons) && reasons.length > 0) {
            const first = reasons[0]
            const detail = first?.message ? `: ${first.message}` : ''
            reasonText = ` (${first?.code || 'error'}${detail})`
          }
          toast({ title: 'Generation failed', description: (result?.error ? `${result.error}${reasonText}` : 'Please try another provider later.') })
        }
      }
    } catch (error) {
      toast({ title: 'Generation error', description: (error as any)?.message || 'Unknown error' })
    } finally {
      setIsGenerating(false)
    }
  }

  // Enter key on Generate tab triggers generation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (activeTab === 'generate' && e.key === 'Enter') {
        if (!isGenerating && description.trim().length > 0) {
          e.preventDefault()
          generatePrompt()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeTab, isGenerating, description])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] bg-gray-900 border-gray-700 text-white overflow-hidden">
        <DialogHeader>
          <DialogTitle>Prompt Manager - {agent?.metadata?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4 bg-gray-800 p-1 rounded-lg">
          <Button
            variant={activeTab === 'current' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('current')}
            className="flex-1"
          >
            Current Prompt
          </Button>
          <Button
            variant={activeTab === 'generate' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('generate')}
            className="flex-1"
          >
            Generate New
          </Button>
          <Button
            variant={activeTab === 'analysis' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('analysis')}
            className="flex-1"
          >
            Analysis
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'current' && (
            <div className="space-y-4">
              <div>
                <Label>System Prompt</Label>
                <Textarea
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  rows={15}
                  className="bg-gray-800 border-gray-700 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-2">Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}</p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={analyzePrompt}
                  disabled={isAnalyzing || !currentPrompt}
                  variant="outline"
                  className="bg-gray-800"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><BarChart className="mr-2 h-4 w-4" /> Analyze Prompt</>
                  )}
                </Button>
                
                <Button
                  onClick={async () => {
                    if (!tokenId) {
                      toast({ title: 'Save failed', description: 'Missing tokenId' })
                      return
                    }
                    try {
                      const res = await fetch('/api/prompt', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tokenId, prompt: currentPrompt })
                      })
                      const data = await res.json()
                      if (res.ok && data?.ok) {
                        setLastUpdated(data.updatedAt || Date.now())
                        toast({ title: 'Saved', description: 'Prompt has been updated.' })
                      } else {
                        toast({ title: 'Save failed', description: data?.error || 'Unknown error' })
                      }
                    } catch (e: any) {
                      toast({ title: 'Save failed', description: e?.message || 'Unknown error' })
                    }
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="space-y-4">
              <div>
                <Label>Agent Description</Label>
                <Textarea
                  placeholder="What is the main purpose of this agent?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div>
                <Label>Capabilities</Label>
                <Input
                  placeholder="Enter capabilities separated by commas"
                  onChange={(e) => setCapabilities(e.target.value.split(',').map(s => s.trim()))}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div>
                <Label>Personality Traits</Label>
                <Input
                  placeholder="Professional, friendly, creative..."
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div>
                <Label>Max output tokens</Label>
                <div className="flex gap-2 mt-1">
                  {[128, 256, 384].map(v => (
                    <Button key={v} type="button" variant={maxTokens === v ? 'default' : 'outline'} className="h-8 px-3" onClick={() => setMaxTokens(v)}>
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={generatePrompt}
                disabled={isGenerating || !description}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Awaiting signature / Generating...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Prompt</>
                )}
              </Button>

              {(activeProvider || activeModel) && (
                <p className="text-xs text-gray-400">
                  Using {activeModel ? activeModel : 'model'} @ {activeProvider ? activeProvider : 'provider'}
                </p>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-4">
              {isAnalyzing ? (
                <div className="grid grid-cols-3 gap-4">
                  <Skeleton className="h-20 bg-gray-800 rounded-lg" />
                  <Skeleton className="h-20 bg-gray-800 rounded-lg" />
                  <Skeleton className="h-20 bg-gray-800 rounded-lg" />
                  <div className="col-span-3 space-y-2">
                    <Skeleton className="h-6 bg-gray-800 rounded" />
                    <Skeleton className="h-24 bg-gray-800 rounded" />
                  </div>
                </div>
              ) : analysis ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Clarity</p>
                      <p className="text-2xl font-bold">{analysis.scores?.clarity ?? 0}/10</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Constraints</p>
                      <p className="text-2xl font-bold">{analysis.scores?.constraints ?? 0}/10</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Safety</p>
                      <p className="text-2xl font-bold">{analysis.scores?.safety ?? 0}/10</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Tips</h4>
                    {Array.isArray(analysis.tips) && analysis.tips.length > 0 ? (
                      <ul className="list-disc pl-6 text-sm text-gray-300 space-y-1">
                        {analysis.tips.map((t: string, i: number) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">No tips available</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Risks</h4>
                    {Array.isArray(analysis.risks) && analysis.risks.length > 0 ? (
                      <ul className="list-disc pl-6 text-sm text-gray-300 space-y-1">
                        {analysis.risks.map((r: string, i: number) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">No risks identified</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analyze your prompt to see detailed insights</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
