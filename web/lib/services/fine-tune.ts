import 'dotenv/config'
import { ethers } from 'ethers'
import { getRpcUrl, getPrivateKey } from '@/lib/server/compute-env'
import fs from 'fs/promises'
import path from 'path'
import { downloadFromStorage, uploadToStorage } from '@/lib/storage/client-server'
import { COMPUTE_ORACLE_ABI, INFT_ABI } from '@/lib/contracts/abis'

export interface FineTuneParams {
  agentId: string
  datasetRoot: string
  baseModel: string
  steps: number
  lr: number
}

const JOB_FILE = path.join(process.cwd(), 'data', 'fineJobs.json')
const MODELS_DIR = path.join(process.cwd(), 'data', 'models')

async function loadJobs(): Promise<Record<string, any>> {
  try {
    const c = await fs.readFile(JOB_FILE, 'utf-8')
    return JSON.parse(c)
  } catch {
    return {}
  }
}

async function saveJobs(jobs: Record<string, any>) {
  await fs.mkdir(path.dirname(JOB_FILE), { recursive: true })
  await fs.writeFile(JOB_FILE, JSON.stringify(jobs, null, 2))
}

export async function requestFineTune(params: FineTuneParams) {
  const provider = new ethers.JsonRpcProvider(getRpcUrl())
  const pk = getPrivateKey()
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
  const wallet = new ethers.Wallet(pk, provider)
  const oracle = new ethers.Contract(
    process.env.NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS!,
    COMPUTE_ORACLE_ABI,
    wallet
  ) as any
  const jobId = await oracle.callStatic.requestJob(
    params.datasetRoot,
    params.baseModel,
    params.steps,
    params.lr
  )
  const tx = await oracle.requestJob(
    params.datasetRoot,
    params.baseModel,
    params.steps,
    params.lr
  )
  await tx.wait()
  const jobs = await loadJobs()
  jobs[jobId] = { ...params, status: 'REQUESTED' }
  await saveJobs(jobs)
  return jobId as string
}

export async function pollJobStatus() {
  const provider = new ethers.JsonRpcProvider(getRpcUrl())
  const pk = getPrivateKey()
  if (!pk) throw new Error('OG_COMPUTE_PRIVATE_KEY not set')
  const wallet = new ethers.Wallet(pk, provider)
  const oracle = new ethers.Contract(
    process.env.NEXT_PUBLIC_COMPUTE_ORACLE_ADDRESS!,
    COMPUTE_ORACLE_ABI,
    wallet
  )
  const jobs = await loadJobs()
  for (const [id, job] of Object.entries(jobs)) {
    if (job.status === 'COMPLETED') continue
    const res = await oracle.getJobStatus(id)
    const status = Number(res[0])
    if (status === 2) {
      const root = res[1]
      const content = await downloadFromStorage(root)
      await fs.mkdir(MODELS_DIR, { recursive: true })
      const file = path.join(MODELS_DIR, `${job.agentId}.json`)
      let models: any[] = []
      try { models = JSON.parse(await fs.readFile(file, 'utf-8')) } catch {}
      const version = models.length + 1
      models.push({ version, rootHash: root, createdAt: new Date().toISOString() })
      await fs.writeFile(file, JSON.stringify(models, null, 2))
      const metaPath = path.join(process.cwd(), 'data', 'metadata', `${job.agentId}.json`)
      let metadata: any = {}
      try { metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8')) } catch {}
      metadata.model = `${job.baseModel}-ft-v${version}`
      const { rootHash } = await uploadToStorage(JSON.stringify(metadata), `agent-${job.agentId}-v${version}.json`)
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_INFT_CONTRACT_ADDRESS!,
        INFT_ABI,
        wallet
      )
      if ((contract as any).setTokenURI) {
        await (contract as any).setTokenURI(job.agentId, rootHash)
      }
      job.status = 'COMPLETED'
      job.resultRoot = root
    }
  }
  await saveJobs(jobs)
}
