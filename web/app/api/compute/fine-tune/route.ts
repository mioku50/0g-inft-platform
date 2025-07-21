import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ethers } from 'ethers'
import { COMPUTE_ORACLE_ABI } from '@/lib/contracts/abis'

export const runtime = 'nodejs'

const JOB_FILE = path.join(process.cwd(), 'data', 'fineJobs.json')

async function loadJobs(): Promise<Record<string, any>> {
  try {
    await fs.mkdir(path.dirname(JOB_FILE), { recursive: true })
    const content = await fs.readFile(JOB_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function saveJobs(jobs: Record<string, any>) {
  await fs.mkdir(path.dirname(JOB_FILE), { recursive: true })
  await fs.writeFile(JOB_FILE, JSON.stringify(jobs, null, 2))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, datasetRoot, baseModel, steps, lr } = body

    // Validate inputs
    if (!agentId || !datasetRoot || !baseModel || !steps || !lr) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
    const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
    
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Server configuration error: missing private key' },
        { status: 500 }
      )
    }

    const wallet = new ethers.Wallet(privateKey, provider)
    
    // Use your existing deployed oracle
    const oracleAddress = process.env.NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS || '0x4918c6bD0aAC81cB284A094a77Ef6E24CA04fA74'
    
    const oracle = new ethers.Contract(
      oracleAddress,
      COMPUTE_ORACLE_ABI,
      wallet
    )

    try {
      // First simulate the transaction to get the job ID
      const jobId = await oracle.requestJob.staticCall(
        datasetRoot,
        baseModel,
        BigInt(steps),
        BigInt(lr)
      )

      // Then execute the actual transaction
      const tx = await oracle.requestJob(
        datasetRoot,
        baseModel,
        BigInt(steps),
        BigInt(lr)
      )
      
      console.log('Fine-tune transaction:', tx.hash)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      
      if (receipt.status !== 1) {
        throw new Error('Transaction failed')
      }

      // Save job data
      const jobs = await loadJobs()
      jobs[jobId.toString()] = {
        agentId,
        datasetRoot,
        baseModel,
        steps,
        lr,
        status: 'REQUESTED',
        statusCode: 1, // Your contract uses 1 for REQUESTED
        txHash: receipt.hash,
        createdAt: new Date().toISOString()
      }
      await saveJobs(jobs)

      return NextResponse.json({ 
        jobId: jobId.toString(),
        txHash: receipt.hash 
      })
    } catch (error: any) {
      console.error('Oracle transaction error:', error)
      
      // Check if it's a specific contract error
      if (error.reason) {
        return NextResponse.json(
          { error: `Contract error: ${error.reason}` },
          { status: 400 }
        )
      }
      
      throw error
    }
  } catch (error: any) {
    console.error('Fine-tune API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start fine-tuning' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'Job ID required' },
        { status: 400 }
      )
    }

    // Load jobs
    const jobs = await loadJobs()
    const job = jobs[id]
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // If job is not completed, check oracle for updates
    if (job.status !== 'COMPLETED') {
      const oracleAddress = process.env.NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS || '0x4918c6bD0aAC81cB284A094a77Ef6E24CA04fA74'
      
      try {
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
        const oracle = new ethers.Contract(
          oracleAddress,
          COMPUTE_ORACLE_ABI,
          provider
        )
        
        // Вызываем getJobStatus
        const result = await oracle.getJobStatus(id)
        
        // В вашем контракте getJobStatus возвращает (JobStatus status, bytes32 resultRoot)
        // где JobStatus это enum: NONE(0), REQUESTED(1), COMPLETED(2)
        let status, resultRoot
        if (Array.isArray(result)) {
          [status, resultRoot] = result
        } else {
          // Если возвращается объект
          status = result.status
          resultRoot = result.resultRoot
        }
        
        // Преобразуем status в число
        const statusNum = Number(status)
        console.log('Job status from oracle:', statusNum, 'resultRoot:', resultRoot)
        
        // Обновляем статус в соответствии с вашим контрактом
        // 0 = NONE, 1 = REQUESTED, 2 = COMPLETED
        if (statusNum === 1) {
          job.status = 'REQUESTED'
          job.statusCode = 1
        } else if (statusNum === 2) {
          job.status = 'COMPLETED'
          job.statusCode = 2
          job.resultRoot = resultRoot
          job.completedAt = new Date().toISOString()
          
          // Update agent metadata with new model version
          try {
            await updateAgentModel(job.agentId, job.baseModel, resultRoot)
          } catch (error) {
            console.error('Failed to update agent model:', error)
          }
        }
        
        // Сохраняем обновленный статус
        jobs[id] = job
        await saveJobs(jobs)
        
      } catch (error) {
        console.error('Failed to check oracle status:', error)
      }
    }

    return NextResponse.json(job)
  } catch (error: any) {
    console.error('Get job status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get job status' },
      { status: 500 }
    )
  }
}

// Helper function to update agent model after fine-tuning
async function updateAgentModel(agentId: string, baseModel: string, resultRoot: string) {
  const MODELS_DIR = path.join(process.cwd(), 'data', 'models')
  await fs.mkdir(MODELS_DIR, { recursive: true })
  
  const modelFile = path.join(MODELS_DIR, `${agentId}.json`)
  let models: any[] = []
  
  try {
    const content = await fs.readFile(modelFile, 'utf-8')
    models = JSON.parse(content)
  } catch {
    // File doesn't exist yet
  }
  
  const version = models.length + 1
  models.push({
    version,
    baseModel,
    resultRoot,
    createdAt: new Date().toISOString()
  })
  
  await fs.writeFile(modelFile, JSON.stringify(models, null, 2))
  
  // Store version in a quick-access file
  const versionFile = path.join(MODELS_DIR, `${agentId}.version`)
  await fs.writeFile(versionFile, version.toString())
}
