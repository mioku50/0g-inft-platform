// web/app/api/storage/retrieve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { downloadFromStorage } from '@/lib/storage/client-server'

export async function POST(request: NextRequest) {
  try {
    const { rootHash } = await request.json()
    
    if (!rootHash) {
      return NextResponse.json(
        { error: 'Root hash is required' },
        { status: 400 }
      )
    }

    console.log('Retrieving data for root hash:', rootHash)
    
    const buffer = await downloadFromStorage(rootHash)
    const content = buffer.toString('utf-8')
    
    console.log('Retrieved content:', content)
    
    return NextResponse.json({
      success: true,
      content,
      rootHash,
    })
  } catch (error) {
    console.error('Retrieve error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve content' },
      { status: 500 }
    )
  }
}