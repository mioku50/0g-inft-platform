import { NextRequest, NextResponse } from 'next/server'
import { getBroker } from '@/lib/compute/broker.server'
import { uploadToStorage } from '@/lib/storage/client-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('[fine-tune-upload] 🚀 Starting dataset upload...')
  
  try {
    // Check environment variables first
    const storageKey = process.env.OG_STORAGE_PRIVATE_KEY
    const storageUrl = process.env.NEXT_PUBLIC_0G_STORAGE_URL
    const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL
    
    console.log('[fine-tune-upload] 🔍 Environment check:', {
      hasStorageKey: !!storageKey,
      storageUrl,
      rpcUrl,
      nodeEnv: process.env.NODE_ENV
    })
    
    if (!storageKey) {
      console.error('[fine-tune-upload] ❌ OG_STORAGE_PRIVATE_KEY not configured')
      return NextResponse.json(
        { 
          error: 'Storage not configured', 
          details: 'OG_STORAGE_PRIVATE_KEY environment variable is missing. Please check your .env.local file.',
          success: false,
          requiredVars: ['OG_STORAGE_PRIVATE_KEY', 'NEXT_PUBLIC_0G_STORAGE_URL', 'NEXT_PUBLIC_0G_RPC_URL']
        },
        { status: 503 }
      )
    }
    
    if (!storageUrl) {
      console.error('[fine-tune-upload] ❌ NEXT_PUBLIC_0G_STORAGE_URL not configured')
      return NextResponse.json(
        { 
          error: 'Storage URL not configured', 
          details: 'NEXT_PUBLIC_0G_STORAGE_URL environment variable is missing',
          success: false
        },
        { status: 503 }
      )
    }

    console.log('[fine-tune-upload] 📁 Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const agentId = formData.get('agentId') as string
    
    console.log('[fine-tune-upload] 🔍 Form data received:', {
      hasFile: !!file,
      agentId,
      formDataKeys: Array.from(formData.keys())
    })
    
    if (!file) {
      console.error('[fine-tune-upload] ❌ No file provided in form data')
      return NextResponse.json(
        { 
          error: 'No file provided',
          details: 'Please select a file to upload',
          success: false
        },
        { status: 400 }
      )
    }

    console.log('[fine-tune-upload] 📊 File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      agentId,
      sizeKB: Math.round(file.size / 1024),
      sizeMB: Math.round(file.size / 1024 / 1024 * 100) / 100
    })
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      console.error('[fine-tune-upload] ❌ File too large:', file.size, 'bytes')
      return NextResponse.json(
        { 
          error: 'File too large',
          details: `File size ${Math.round(file.size / 1024 / 1024 * 100) / 100}MB exceeds 10MB limit`,
          success: false
        },
        { status: 413 }
      )
    }
    
    // Validate file type
    const allowedExtensions = ['.jsonl', '.json', '.txt']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      console.error('[fine-tune-upload] ❌ Invalid file type:', fileExtension)
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          details: `File type ${fileExtension} not supported. Use: ${allowedExtensions.join(', ')}`,
          success: false
        },
        { status: 400 }
      )
    }

    // Read file content
    console.log('[fine-tune-upload] 📖 Reading file content...')
    const fileContent = await file.text()
    console.log('[fine-tune-upload] 📄 File content preview:', fileContent.substring(0, 200) + '...')
    console.log('[fine-tune-upload] 📏 Content length:', fileContent.length, 'characters')
    
    // Parse dataset and count examples
    let dataSize = 0
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      
      if (fileExtension === 'json') {
        // Handle JSON format - could be array of objects or single object
        const jsonData = JSON.parse(fileContent)
        if (Array.isArray(jsonData)) {
          dataSize = jsonData.length
        } else if (jsonData.messages) {
          dataSize = 1 // Single conversation
        } else {
          dataSize = 1 // Fallback for other JSON structures
        }
        console.log('[fine-tune-upload] JSON dataset contains', dataSize, 'examples')
      } else {
        // Handle JSONL format (default) - count non-empty lines
        const lines = fileContent.trim().split('\n').filter(line => line.trim())
        dataSize = lines.length
        console.log('[fine-tune-upload] JSONL dataset contains', dataSize, 'examples')
      }
    } catch (error) {
      console.warn('[fine-tune-upload] Could not parse dataset for counting:', error)
      // Fallback to line counting
      const lines = fileContent.trim().split('\n').filter(line => line.trim())
      dataSize = lines.length
    }

    // Upload to 0G Storage
    const filename = `dataset-${agentId}-${Date.now()}.txt`
    console.log('[fine-tune-upload] ☁️ Uploading to 0G Storage as:', filename)
    
    try {
      const result = await uploadToStorage(fileContent, filename)
      console.log('[fine-tune-upload] ✅ Upload successful:', result)
      
      if (!result || !result.rootHash) {
        throw new Error('Upload result missing rootHash')
      }
      
      // Clean rootHash if needed
      let rootHash = result.rootHash
      if (rootHash.includes('http://') || rootHash.includes('https://')) {
        const parts = rootHash.split('/')
        rootHash = parts[parts.length - 1]
        console.log('[fine-tune-upload] 🧹 Cleaned rootHash:', rootHash)
      }

      const response = {
        success: true,
        rootHash,
        dataSize,
        filename,
        uploadSize: file.size,
        message: `Dataset uploaded successfully with ${dataSize} examples`,
        // Include debug info in development
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            originalRootHash: result.rootHash,
            txHash: result.txHash,
            size: result.size,
            segments: result.segments
          }
        })
      }
      
      console.log('[fine-tune-upload] 🎉 Returning success response:', response)
      return NextResponse.json(response)
      
    } catch (uploadError) {
      console.error('[fine-tune-upload] ❌ Upload to 0G Storage failed:', uploadError)
      
      // Try to provide more specific error messages
      let errorMessage = 'Failed to upload to 0G Storage'
      let errorDetails = uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
      
      if (errorDetails.includes('OG_STORAGE_PRIVATE_KEY')) {
        errorMessage = 'Storage private key not configured'
        errorDetails = 'Please check that OG_STORAGE_PRIVATE_KEY is set in your environment'
      } else if (errorDetails.includes('network') || errorDetails.includes('fetch')) {
        errorMessage = 'Network error during upload'
        errorDetails = 'Please check your internet connection and 0G Storage service availability'
      } else if (errorDetails.includes('gas') || errorDetails.includes('transaction')) {
        errorMessage = 'Blockchain transaction failed'
        errorDetails = 'Transaction to 0G Storage failed. Please try again or check gas settings'
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: errorDetails,
          success: false,
          // Include debug info in development
          ...(process.env.NODE_ENV === 'development' && {
            debug: {
              originalError: uploadError instanceof Error ? uploadError.stack : uploadError,
              filename,
              dataSize,
              fileSize: file.size
            }
          })
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('[fine-tune-upload] ❌ Critical error during upload process:', error)
    
    return NextResponse.json(
      { 
        error: 'Upload process failed', 
        details: error instanceof Error ? error.message : 'Unknown critical error',
        success: false,
        // Include debug info in development
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            errorStack: error instanceof Error ? error.stack : 'No stack trace',
            timestamp: new Date().toISOString()
          }
        })
      },
      { status: 500 }
    )
  }
}