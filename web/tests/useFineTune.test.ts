/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFineTune } from '../hooks/useFineTune'

vi.stubGlobal('fetch', vi.fn(async () => ({
  ok: true,
  json: async () => ({ progress: 'Running' })
})) as any)

describe('useFineTune', () => {
  it('polls /v1 endpoint', async () => {
    const { result } = renderHook(() => useFineTune('0x1', 'task'))
    await new Promise(r => setTimeout(r, 10))
    expect(fetch).toHaveBeenCalledWith('/v1/user/0x1/task/task')
    expect(result.current).toEqual({ progress: 'Running' })
  })
})
