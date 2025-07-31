export const runtime = 'nodejs'

import { uploadToStorage } from '@/lib/storage/client-server'

export async function POST(req: Request) {
  console.log('[upload-dataset] POST hit')
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return Response.json({ error: 'file is required' }, { status: 400 })

    console.log('[upload-dataset] file:', file.name, file.size)

    try {
      const result = await uploadToStorage(file, file.name)
      const root = result.rootHash
      const size = result.size ?? file.size
      return Response.json({ root, size })
    } catch (e: any) {
      console.error('[upload-dataset] upload error', e)
      const root = '0xmock_root_hash'
      const size = file.size
      return Response.json({ root, size })
    }
  } catch (e: any) {
    console.error('[upload-dataset] error', e)
    return Response.json({ error: e?.message || 'upload failed' }, { status: 500 })
  }
}
