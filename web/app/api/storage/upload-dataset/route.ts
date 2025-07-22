// web/app/api/storage/upload-dataset/route.ts
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
    
    // Убедитесь что файл действительно загружается в 0G Storage
    const result = await uploadToStorage(file, file.name)
    
    // Проверяем что это не локальный hash
    if (result.rootHash.startsWith('local://')) {
      return NextResponse.json({ 
        error: 'Failed to upload to 0G Storage. Please check your storage configuration.',
        localHash: result.rootHash 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      rootHash: result.rootHash,
      size: result.size,
      segments: result.segments
    })
  } catch (err: any) {
    console.error('Dataset upload error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to upload dataset' },
      { status: 500 }
    )
  }
}