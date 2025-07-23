import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('../lib/compute/broker', () => ({
  getBroker: vi.fn(async () => ({
    signer: { address: '0x1' },
    fineTuning: {
      getAccount: vi.fn(async () => ({ balance: 1000000000000000000n, pendingRefund: 0n })),
      accountExists: vi.fn(async () => true)
    }
  }))
}))

vi.mock('../lib/compute/fine-tune-service', () => ({
  FineTuneService: class {
    constructor() {}
    async getAccountBalance() { return '1' }
  }
}))

import { GET } from '../app/api/compute/account/route'
import { NATIVE_SYMBOL } from '../lib/constants'

describe('account route', () => {
  it('returns balance in OG', async () => {
    const res = await GET(new NextRequest('http://localhost'))
    const data = await res.json()
    expect(data.account.balance).toBe('1')
    expect(data.recommendations.minimumBalance).toBe('0.001')
    expect(res.ok).toBe(true)
  })
})
