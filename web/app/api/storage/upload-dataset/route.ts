import { NextRequest } from 'next/server'
import { POST as uploadDataset } from '@/app/api/compute/fine-tune/upload/route'

export const runtime = 'nodejs'

export function POST(req: NextRequest) {
  return uploadDataset(req)
}
