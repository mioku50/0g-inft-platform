// web/app/api/compute/generate-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createBrokerWithEnvPK } from '@/lib/compute/broker'

export async function POST(request: NextRequest) {
  try {
    const { description, capabilities, personality } = await request.json()
    
    const broker = await createBrokerWithEnvPK()
    
    // Используем официальный провайдер для генерации
    const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
    
    const prompt = `Generate a detailed system prompt for an AI agent with these characteristics:
    
Description: ${description}
Capabilities: ${capabilities.join(', ')}
Personality: ${personality}

Create a comprehensive system prompt that:
1. Clearly defines the agent's role and purpose
2. Sets boundaries and limitations
3. Establishes the communication style
4. Includes specific examples of responses
5. Defines ethical guidelines

Format: Return only the system prompt text, no explanations.`

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
    const headers = await broker.inference.getRequestHeaders(providerAddress, prompt)
    
    const OpenAI = require('openai')
    const openai = new OpenAI({ baseURL: endpoint, apiKey: '' })
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: model,
      temperature: 0.7,
      max_tokens: 1000
    }, { headers })
    
    const generatedPrompt = completion.choices[0].message.content
    
    // Верифицируем ответ
    await broker.inference.processResponse(
      providerAddress,
      generatedPrompt,
      completion.id
    )
    
    return NextResponse.json({
      success: true,
      prompt: generatedPrompt
    })
    
  } catch (error: any) {
    console.error('Prompt generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}