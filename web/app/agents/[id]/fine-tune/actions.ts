'use server'

export async function uploadDataset(formData: FormData) {
  const { uploadToStorage, hashAndExists } = await (Function('return import')())('@/lib/storage/client-server')
  const file = formData.get('file') as File | null
  if (!file) throw new Error('file required')
  const buffer = Buffer.from(await file.arrayBuffer())
  const { root, exists } = await hashAndExists(buffer)
  if (!exists) {
    const up = await uploadToStorage(buffer, file.name)
    return { rootHash: up.rootHash, size: up.size, uploaded: true }
  }
  return { rootHash: root, size: buffer.length, uploaded: false }
}
