import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage, headOnStorage } from '@/lib/storage/client-server'
import crypto from 'crypto'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const data = await req.formData()
  const file = data.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const hex = '0x' + crypto.createHash('sha256').update(buffer).digest('hex')

  const exists = await headOnStorage(hex).catch(() => false)
  if (exists) return NextResponse.json({ root: hex, size: buffer.length })

  const res = await uploadToStorage(buffer)
  const root = typeof res === 'string' ? res : res.rootHash
  return NextResponse.json({ root, size: buffer.length })
}
