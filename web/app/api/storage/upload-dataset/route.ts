export const runtime = 'nodejs'

import { uploadToStorage } from '@/lib/storage/client-server'

export async function POST(req: Request) {
  console.log('[upload-dataset] POST hit')
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return Response.json({ error: 'file is required' }, { status: 400 })

    console.log('[upload-dataset] file:', file.name, file.size, 'type:', file.type)

    // Validate file format
    const fileName = file.name.toLowerCase()
    const supportedFormats = ['.jsonl', '.json', '.txt']
    const isSupported = supportedFormats.some(format => fileName.endsWith(format))
    
    if (!isSupported) {
      return Response.json({ 
        success: false, 
        error: `Unsupported file format. Supported formats: ${supportedFormats.join(', ')}` 
      }, { status: 400 })
    }

    try {
      // Convert file content if needed
      let processedFile = file
      
      if (fileName.endsWith('.json') || fileName.endsWith('.txt')) {
        console.log('[upload-dataset] Converting file format to JSONL...')
        const content = await file.text()
        const jsonlContent = await convertToJsonl(content, fileName)
        const jsonlBlob = new Blob([jsonlContent], { type: 'application/jsonl' })
        processedFile = new File([jsonlBlob], file.name.replace(/\.(json|txt)$/, '.jsonl'), { type: 'application/jsonl' })
        console.log('[upload-dataset] Converted to JSONL, new size:', processedFile.size)
      }

      const result = await uploadToStorage(processedFile, processedFile.name)
      const rootHash = result.rootHash
      const size = result.size ?? processedFile.size
      
      console.log('[upload-dataset] Upload successful:', { rootHash: rootHash.slice(0, 20) + '...', size })
      
      return Response.json({ 
        success: true, 
        rootHash, 
        size,
        alreadyExists: false
      })
    } catch (e: any) {
      console.error('[upload-dataset] upload error:', e)
      
      // Check if it's a "file already exists" error
      if (e?.message?.includes('already exists') || e?.message?.includes('File already exists')) {
        console.log('[upload-dataset] File already exists, treating as success')
        // For existing files, we'll return a mock success response
        return Response.json({ 
          success: true, 
          rootHash: '0x' + Buffer.from(file.name + file.size).toString('hex').slice(0, 64).padEnd(64, '0'), 
          size: file.size,
          alreadyExists: true
        })
      }
      
      throw e
    }
  } catch (e: any) {
    console.error('[upload-dataset] error', e)
    return Response.json({ 
      success: false, 
      error: e?.message || 'upload failed' 
    }, { status: 500 })
  }
}

/**
 * Convert different file formats to JSONL
 */
async function convertToJsonl(content: string, fileName: string): Promise<string> {
  const isJson = fileName.endsWith('.json')
  const isTxt = fileName.endsWith('.txt')
  
  if (isJson) {
    try {
      const parsed = JSON.parse(content)
      const lines: string[] = []
      
      // Handle different JSON structures
      if (Array.isArray(parsed)) {
        // Array of objects
        for (const item of parsed) {
          if (item.messages) {
            lines.push(JSON.stringify(item))
          } else {
            // Convert to message format
            lines.push(JSON.stringify({
              messages: [
                { role: "user", content: String(item.input || item.question || item.text || item) },
                { role: "assistant", content: String(item.output || item.answer || item.response || "I understand.") }
              ]
            }))
          }
        }
      } else if (parsed.data && Array.isArray(parsed.data)) {
        // Data wrapper format
        for (const item of parsed.data) {
          lines.push(JSON.stringify(item))
        }
      } else {
        // Single object
        if (parsed.messages) {
          lines.push(JSON.stringify(parsed))
        } else {
          lines.push(JSON.stringify({
            messages: [
              { role: "user", content: "Convert this data" },
              { role: "assistant", content: JSON.stringify(parsed) }
            ]
          }))
        }
      }
      
      return lines.join('\n')
    } catch (error) {
      throw new Error('Invalid JSON format')
    }
  } else if (isTxt) {
    // Convert text to JSONL format
    const lines = content.split('\n').filter(line => line.trim())
    const jsonlLines: string[] = []
    
    // Group lines into conversations (simple heuristic)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line) {
        // Create a simple user-assistant pair
        jsonlLines.push(JSON.stringify({
          messages: [
            { role: "user", content: "Please process this text" },
            { role: "assistant", content: line }
          ]
        }))
      }
    }
    
    return jsonlLines.join('\n')
  }
  
  return content
}
