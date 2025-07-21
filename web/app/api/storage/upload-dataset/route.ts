import { NextRequest, NextResponse } from 'next/server'
import { uploadToStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const result = await uploadToStorage(file, file.name)
    return NextResponse.json({ rootHash: result.rootHash })
  } catch (err: any) {
    console.error('Dataset upload error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to upload dataset' },
      { status: 500 }
    )
  }
}
