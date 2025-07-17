// web/app/agents/[id]/fine-tune/page.tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Brain, Upload, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

interface TrainingExample {
  input: string
  output: string
}

export default function FineTunePage() {
  const params = useParams()
  const router = useRouter()
  const [examples, setExamples] = useState<TrainingExample[]>([
    { input: '', output: '' }
  ])
  const [loading, setLoading] = useState(false)

  const addExample = () => {
    setExamples([...examples, { input: '', output: '' }])
  }

  const removeExample = (index: number) => {
    setExamples(examples.filter((_, i) => i !== index))
  }

  const updateExample = (index: number, field: 'input' | 'output', value: string) => {
    const updated = [...examples]
    updated[index][field] = value
    setExamples(updated)
  }

  const handleFineTune = async () => {
    setLoading(true)
    try {
      // Валидация
      const validExamples = examples.filter(e => e.input && e.output)
      if (validExamples.length < 3) {
        throw new Error('Please provide at least 3 training examples')
      }

      // Отправляем на API
      const response = await fetch('/api/compute/prepare-training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: params.id,
          trainingData: validExamples.map(ex => ({
            systemPrompt: 'You are a helpful AI assistant.',
            userInput: ex.input,
            expectedOutput: ex.output
          }))
        })
      })

      if (!response.ok) throw new Error('Failed to prepare training data')

      const result = await response.json()
      
      toast({
        title: 'Success!',
        description: `Training data prepared. ${result.recordCount} examples ready for fine-tuning.`
      })

      // Переход обратно к агенту
      setTimeout(() => {
        router.push(`/agents`)
      }, 2000)

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Brain className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">Fine-tune Agent #{params.id}</h1>
          </div>

          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Training Examples</h2>
              <p className="text-gray-600">
                Provide examples of how your agent should respond to different inputs
              </p>
            </div>

            <div className="space-y-4">
              {examples.map((example, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline">Example {index + 1}</Badge>
                    {examples.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeExample(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div>
                    <Label>User Input</Label>
                    <Textarea
                      placeholder="What the user says..."
                      value={example.input}
                      onChange={(e) => updateExample(index, 'input', e.target.value)}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <Label>Expected Response</Label>
                    <Textarea
                      placeholder="How the agent should respond..."
                      value={example.output}
                      onChange={(e) => updateExample(index, 'output', e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={addExample}
                className="border-dashed border-2"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Example
              </Button>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/agents')}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFineTune}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Fine-tuning
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}