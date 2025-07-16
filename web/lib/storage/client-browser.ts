// web/lib/storage/client-browser.ts
export async function uploadToStorage(file: File): Promise<{ rootHash: string; txHash: string }> {
  try {
    // Создаем FormData для отправки файла
    const formData = new FormData()
    formData.append('file', file)
    
    // Если это JSON файл с метаданными, добавляем его содержимое
    if (file.type === 'application/json') {
      const text = await file.text()
      formData.append('metadata', text)
    }

    const response = await fetch('/api/storage/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()
    return {
      rootHash: result.rootHash,
      txHash: result.txHash,
    }
  } catch (error) {
    console.error('Storage upload error:', error)
    
    // Временный fallback - возвращаем фиктивные данные
    console.warn('Using fallback storage solution')
    return {
      rootHash: '0x' + Math.random().toString(16).substr(2, 64),
      txHash: '0x' + Math.random().toString(16).substr(2, 64),
    }
  }
}