import { vi } from 'vitest'

vi.mock('ethers', async () => {
  const actual = await vi.importActual<any>('ethers')
  return {
    ...actual,
    parseEther: (v: string) => BigInt(Math.floor(Number(v) * 1e18)),
    formatEther: (bn: bigint) => (Number(bn) / 1e18).toString()
  }
})
