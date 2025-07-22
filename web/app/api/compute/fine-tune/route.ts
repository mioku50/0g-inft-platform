import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { saveTask } from '@/lib/compute/local-tasks'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { agentId, datasetRoot, baseModel, steps, learningRate } = await req.json()
    const service = new FineTuneService(await getBroker())
    const taskId = await service.createTask({
      agentId,
      datasetRootHash: datasetRoot,
      baseModel,
      steps,
      learningRate
    })
    await saveTask(agentId, taskId)
    return NextResponse.json({ taskId })
  } catch (e: any) {
    console.error('fine-tune POST error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  try {
    const service = new FineTuneService(await getBroker())
    const status = await service.getStatus(taskId)
    if (status.progress === 'Delivered') {
      await service.acknowledge(taskId)
    }
    return NextResponse.json(status)
  } catch (e: any) {
    console.error('fine-tune GET error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
