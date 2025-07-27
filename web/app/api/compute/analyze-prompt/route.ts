// web/app/api/compute/analyze-prompt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getRpcUrl, getPrivateKey } from '@/lib/server/compute-env'
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker')

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()
    
    const provider = new ethers.JsonRpcProvider(getRpcUrl())
    const pk = getPrivateKey()
    if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
    const wallet = new ethers.Wallet(pk, provider)
    
    const broker = await createZGComputeNetworkBroker(wallet)
    
    const providerAddress = '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
    
    const analysisPrompt = `Analyze this AI system prompt and provide suggestions for improvement:

"${prompt}"

Analyze and provide:
1. Strengths of the current prompt
2. Weaknesses or gaps
3. Specific improvement suggestions
4. Score from 1-10 for: Clarity, Completeness, Effectiveness
5. Optimized version of the prompt

Format your response as JSON with these fields:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."],
  "scores": {
    "clarity": 0,
    "completeness": 0,
    "effectiveness": 0
  },
  "optimizedPrompt": "..."
}`

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress)
    const headers = await broker.inference.getRequestHeaders(providerAddress, analysisPrompt)
    
    const OpenAI = require('openai')
    const openai = new OpenAI({ baseURL: endpoint, apiKey: '' })
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: analysisPrompt }],
      model: model,
      temperature: 0.3,
      max_tokens: 2000
    }, { headers })
    
    const analysis = JSON.parse(completion.choices[0].message.content)
    
    await broker.inference.processResponse(
      providerAddress,
      JSON.stringify(analysis),
      completion.id
    )
    
    return NextResponse.json({
      success: true,
      analysis
    })
    
  } catch (error: any) {
    console.error('Prompt analysis error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}