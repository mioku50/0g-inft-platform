import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { requestFineTune, pollJobStatus } from '@/lib/services/fine-tune'

export const runtime = 'nodejs'

const JOB_FILE = path.join(process.cwd(), 'data', 'fineJobs.json')

export async function POST(req: NextRequest) {
  const body = await req.json()
  const jobId = await requestFineTune(body)
  return NextResponse.json({ jobId })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  await pollJobStatus()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  let jobs: any = {}
  try { jobs = JSON.parse(await fs.readFile(JOB_FILE, 'utf-8')) } catch {}
  return NextResponse.json(jobs[id] || { status: 'unknown' })
}
