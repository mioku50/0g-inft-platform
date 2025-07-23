// app/agents/[id]/fine-tune-simple/page.tsx
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Brain, Upload, Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import Link from 'next/link'

interface TrainingExample {
  input: string
  output: string
}

export default function SimpleFineTunePage() {
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
      const validExamples = examples.filter(e => e.input.trim() && e.output.trim())
      if (validExamples.length < 3) {
        throw new Error('Please provide at least 3 complete training examples')
      }

      console.log('Preparing training data with examples:', validExamples)

      // Шаг 1: Подготовка данных
      const prepareResponse = await fetch('/api/compute/prepare-training-data', {
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

      if (!prepareResponse.ok) {
        const error = await prepareResponse.json()
        throw new Error(error.details || 'Failed to prepare training data')
      }

      const prepareResult = await prepareResponse.json()
      console.log('Training data prepared:', prepareResult)

      toast({
        title: 'Data Prepared!',
        description: `${prepareResult.recordCount} training examples prepared successfully.`
      })

      // Шаг 2: Запуск fine-tuning
      const finetuneResponse = await fetch('/api/compute/fine-tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: params.id,
          datasetRoot: prepareResult.rootHash,
          dataSize: prepareResult.size,
          baseModel: 'llama-3.3-70b',
          steps: Math.min(500, validExamples.length * 10), // Адаптивное количество шагов
          learningRate: 0.00005
        })
      })

      if (!finetuneResponse.ok) {
        const error = await finetuneResponse.json()
        throw new Error(error.details || 'Failed to start fine-tuning')
      }

      const finetuneResult = await finetuneResponse.json()
      console.log('Fine-tuning started:', finetuneResult)

      toast({
        title: 'Fine-tuning Started!',
        description: `Task ${finetuneResult.taskId.slice(0, 8)}... - ${finetuneResult.estimatedTime}`
      })

      // Переход к странице мониторинга
      setTimeout(() => {
        router.push(`/agents/${params.id}/fine-tune`)
      }, 2000)

    } catch (error: any) {
      console.error('Fine-tuning error:', error)
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
          {/* Header */}
          <div className="mb-8">
            <Link href="/agents">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Agents
              </Button>
            </Link>
            
            <div className="flex items-center gap-3 mb-2">
              <Brain className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-800">Quick Fine-tune Agent #{params.id}</h1>
            </div>
            <p className="text-gray-600">
              Provide examples to teach your agent new behaviors
            </p>
          </div>

          <Card className="bg-white/90 backdrop-blur border-0 shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Training Examples</h2>
              <p className="text-gray-600">
                Show your agent how to respond to different inputs. Minimum 3 examples required.
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
                      placeholder="What the user might ask..."
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

            {/* Training Info */}
            <div className="mt-8 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Training Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Base Model:</span>
                  <span className="ml-2 font-medium">Llama 3.3 70B</span>
                </div>
                <div>
                  <span className="text-blue-700">Training Steps:</span>
                  <span className="ml-2 font-medium">Auto (based on examples)</span>
                </div>
                <div>
                  <span className="text-blue-700">Learning Rate:</span>
                  <span className="ml-2 font-medium">0.00005</span>
                </div>
                <div>
                  <span className="text-blue-700">Estimated Time:</span>
                  <span className="ml-2 font-medium">30-60 minutes</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/agents')}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFineTune}
                disabled={loading || examples.filter(e => e.input.trim() && e.output.trim()).length < 3}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Fine-tuning...
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