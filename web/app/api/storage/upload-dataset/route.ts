import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage, hashAndExists } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const data = await req.formData()
  const file = data.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const { root, exists } = await hashAndExists(buffer)
  if (!exists) {
    await uploadToStorage(buffer, file.name)
  }
  return NextResponse.json({ rootHash: root, size: buffer.length, uploaded: !exists })
}
