// app/api/compute/fine-tune/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBrokerOrThrow, getSignerAddress } from '@/lib/compute/broker'
import { FineTuneService } from '@/lib/compute/fine-tune-service'
import { validateComputeEnvironment, getFineTuneProvider } from '@/lib/server/compute-env'

export const runtime = 'nodejs'

/**
 * GET /api/compute/fine-tune/tasks - Получение списка задач пользователя
 */
export async function GET(request: NextRequest) {
  // Validate environment first
  const envValidation = validateComputeEnvironment()
  if (!envValidation.isValid) {
    console.error('[compute/fine-tune/tasks][GET] Environment validation failed:', envValidation.errors)
    return NextResponse.json({ 
      error: 'Compute misconfigured', 
      details: envValidation.errors 
    }, { status: 503 })
  }

  let broker: any
  try {
    broker = await getBrokerOrThrow()
  } catch (e: any) {
    console.error('[compute/fine-tune/tasks][GET] broker init error', e)
    return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
  }
  
  try {
    const signerAddress = getSignerAddress(broker)
    if (!signerAddress) {
      return NextResponse.json({ error: 'Wallet not connected' }, { status: 401 })
    }
    
    // Получение информации о провайдере
    const { endpoint } = await broker.inference.getServiceMetadata(getFineTuneProvider())
    
    // Получение списка задач пользователя
    const response = await fetch(`${endpoint}/v1/user/${signerAddress}/task`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Provider error:', response.status, response.statusText)
      return NextResponse.json({ error: 'Provider unavailable' }, { status: 503 })
    }

    const tasks = await response.json()
    console.log(`Retrieved ${tasks.length} tasks for user ${signerAddress}`)

    return NextResponse.json(tasks)

  } catch (error: any) {
    console.error('Error getting tasks list:', error)
    const msg = error.message
    
    if (
      msg?.includes('Missing env') ||
      msg?.includes('Contract not deployed') ||
      msg?.includes('Failed to start')
    ) {
      return NextResponse.json({ error: 'Compute misconfigured' }, { status: 503 })
    }
    
    return NextResponse.json(
      {
        error: 'Failed to get tasks list',
        details: msg || 'Unknown error'
      },
      { status: 500 }
    )
  }
}