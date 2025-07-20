// web/app/api/compute/prepare-training-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
export async function POST(request: NextRequest) {
  try {
    const { agentId, trainingData } = await request.json()
    
    // Форматируем данные для fine-tuning
    const formattedData = trainingData.map((item: any) => ({
      messages: [
        { role: 'system', content: item.systemPrompt },
        { role: 'user', content: item.userInput },
        { role: 'assistant', content: item.expectedOutput }
      ]
    }))
    
    // Сохраняем в 0G Storage
    const jsonl = formattedData
      .map((item: any) => JSON.stringify(item))
      .join('\n')
    
    const uploadResponse = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: jsonl,
        filename: `training-data-${agentId}.jsonl`
      })
    })
    
    const { rootHash } = await uploadResponse.json()
    
    return NextResponse.json({
      success: true,
      dataHash: rootHash,
      recordCount: formattedData.length
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}