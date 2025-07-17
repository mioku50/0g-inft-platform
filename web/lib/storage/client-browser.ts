// web/lib/storage/client-browser.ts
export async function uploadToStorage(file: File): Promise<{ rootHash: string; txHash: string }> {
  try {
    // Если это изображение, отправляем как FormData
    if (file.type.startsWith('image/')) {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      return await response.json()
    } 
    // Если это JSON метаданные
    else if (file.type === 'application/json') {
      const text = await file.text()
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          filename: file.name
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      return await response.json()
    }
    // Для других типов файлов
    else {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      return await response.json()
    }
  } catch (error) {
    console.error('Storage upload error:', error)
    throw error
  }
}

// Дополнительная функция для загрузки метаданных напрямую
export async function uploadMetadata(metadata: any): Promise<{ rootHash: string; txHash: string }> {
  try {
    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: JSON.stringify(metadata),
        filename: `agent-${Date.now()}.json`
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    return await response.json()
  } catch (error) {
    console.error('Metadata upload error:', error)
    throw error
  }
}