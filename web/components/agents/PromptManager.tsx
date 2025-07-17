import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, BarChart, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface PromptManagerProps {
  agent: any
  isOpen: boolean
  onClose: () => void
  onUpdate: (newPrompt: string) => void
}

export function PromptManager({ agent, isOpen, onClose, onUpdate }: PromptManagerProps) {
  const [currentPrompt, setCurrentPrompt] = useState(agent?.metadata?.systemPrompt || '')
  const [activeTab, setActiveTab] = useState<'current' | 'generate' | 'analysis'>('current')
  const [analysis, setAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [description, setDescription] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [personality, setPersonality] = useState('')

  const analyzePrompt = async () => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/compute/analyze-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt })
      })
      
      const result = await response.json()
      if (result.success) {
        setAnalysis(result.analysis)
        setActiveTab('analysis')
      }
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generatePrompt = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/compute/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          capabilities,
          personality
        })
      })
      
      const result = await response.json()
      if (result.success) {
        setCurrentPrompt(result.prompt)
        setAnalysis(null)
        setActiveTab('current')
      }
    } catch (error) {
      console.error('Generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

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
                  onClick={() => onUpdate(currentPrompt)}
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

              <Button
                onClick={generatePrompt}
                disabled={isGenerating || !description}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Prompt</>
                )}
              </Button>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-4">
              {analysis ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Clarity</p>
                      <p className="text-2xl font-bold">{analysis.scores?.clarity || 0}/10</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Completeness</p>
                      <p className="text-2xl font-bold">{analysis.scores?.completeness || 0}/10</p>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg text-center">
                      <p className="text-sm text-gray-400">Effectiveness</p>
                      <p className="text-2xl font-bold">{analysis.scores?.effectiveness || 0}/10</p>
                    </div>
                  </div>

                  {analysis.optimizedPrompt && (
                    <div>
                      <h4 className="font-semibold mb-2">Optimized Version</h4>
                      <Alert className="bg-purple-900/30 border-purple-500/30">
                        <AlertDescription className="whitespace-pre-wrap">
                          {analysis.optimizedPrompt}
                        </AlertDescription>
                      </Alert>
                      <Button
                        onClick={() => {
                          setCurrentPrompt(analysis.optimizedPrompt)
                          setActiveTab('current')
                        }}
                        className="mt-2"
                        size="sm"
                      >
                        Use This Version
                      </Button>
                    </div>
                  )}
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
