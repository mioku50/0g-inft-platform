// web/app/api/compute/acknowledge-model/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json()
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 })
    }
    
    const broker = await getBroker()
    const fineTuneService = new FineTuneService(broker)
    
    const result = await fineTuneService.acknowledgeModel(taskId)
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Acknowledge error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}