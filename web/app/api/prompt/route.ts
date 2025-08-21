import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

function getFilePath(tokenId: number) {
  const dir = path.join(process.cwd(), 'data', 'prompts')
  const file = path.join(dir, `${tokenId}.json`)
  return { dir, file }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenIdParam = searchParams.get('agentId') || searchParams.get('tokenId')
    if (!tokenIdParam) {
      return NextResponse.json({ prompt: '' })
    }
    const tokenId = Number(tokenIdParam)
    if (!Number.isFinite(tokenId)) {
      return NextResponse.json({ prompt: '' })
    }

    const { file } = getFilePath(tokenId)
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const data = JSON.parse(raw)
      return NextResponse.json({ prompt: data?.prompt ?? '', updatedAt: data?.updatedAt ?? null })
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        return NextResponse.json({ prompt: '' })
      }
      return NextResponse.json({ prompt: '' })
    }
  } catch (e) {
    return NextResponse.json({ prompt: '' })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const tokenIdRaw = body?.tokenId ?? body?.agentId
    const prompt: string = body?.prompt ?? ''
    const tokenId = Number(tokenIdRaw)
    if (!Number.isFinite(tokenId)) {
      return NextResponse.json({ ok: false, error: 'invalid_tokenId' }, { status: 400 })
    }
    const { dir, file } = getFilePath(tokenId)
    await fs.mkdir(dir, { recursive: true })
    const payload = { prompt: String(prompt || ''), updatedAt: Date.now() }
    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, ...payload })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'save_failed', message: e?.message }, { status: 500 })
  }
}

