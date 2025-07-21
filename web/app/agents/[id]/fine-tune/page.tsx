'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Button } from '@/components/ui'
import { useFineTune } from '@/hooks/useFineTune'

export default function FineTunePage({ params }: { params: { id: string } }) {
  const [dataset, setDataset] = useState('')
  const [baseModel, setBaseModel] = useState('llama-3.3-70b')
  const [steps, setSteps] = useState(100)
  const [lr, setLr] = useState(1)
  const [jobId, setJobId] = useState<string | null>(null)
  const data = useFineTune(jobId)
  const router = useRouter()

  const start = async () => {
    const res = await fetch('/api/compute/fine-tune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: params.id,
        datasetRoot: dataset,
        baseModel,
        steps: Number(steps),
        lr: Number(lr)
      })
    })
    const j = await res.json()
    setJobId(j.jobId)
  }

  return (
    <div className="p-4 space-y-4">
      {!jobId ? (
        <div className="space-y-4">
          <Input value={dataset} onChange={e => setDataset(e.target.value)} placeholder='Dataset root' />
          <Input value={baseModel} onChange={e => setBaseModel(e.target.value)} placeholder='Base model' />
          <Input type='number' value={steps} onChange={e => setSteps(Number(e.target.value))} placeholder='steps' />
          <Input type='number' value={lr} onChange={e => setLr(Number(e.target.value))} placeholder='lr' />
          <Button onClick={start}>Start Fine-Tune</Button>
        </div>
      ) : (
        <div>
          <p>Job ID: {jobId}</p>
          <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
