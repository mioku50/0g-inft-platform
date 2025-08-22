import { ethers } from 'ethers'
import { getServerProvider } from '../server/provider'

let _create: any = null

async function loadCreateFn() {
  if (_create) return _create
  // Благодаря алиасу в next.config.js это загрузит CJS-вход
  const mod: any = await import('@0glabs/0g-serving-broker')
  _create = mod?.createZGComputeNetworkBroker ?? mod?.default?.createZGComputeNetworkBroker
  if (!_create) throw new Error('createZGComputeNetworkBroker not found')
  return _create
}

// Унифицированный конструктор: используем modern сигнатуру без ручной передачи адресов
export async function createBrokerWithEnvPK() {
  const create = await loadCreateFn()

  const provider = getServerProvider()
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY
  if (!pk) throw new Error('Missing OG_COMPUTE_PRIVATE_KEY/OG_STORAGE_PRIVATE_KEY')
  const wallet = new ethers.Wallet(pk, provider)

  // Modern: SDK знает адреса тестнета сам, передаём только signer
  const broker = await create(wallet)
  // Добавим адрес кошелька для кеширования ACK per-wallet
  try {
    ;(broker as any).__walletAddress = wallet.address
  } catch {}
  return broker
}

// Общий кеш ACK для процесса: ключом (walletAddress, providerAddress)
const ackCache = new Set<string>()

export function getAckCacheKey(broker: any, providerAddress: string): string {
  const walletAddr: string | undefined = (broker as any).__walletAddress
  return `${walletAddr || 'unknown'}:${providerAddress}`
}

// Константа точности леджера (атомарные единицы)
export const LEDGER_DECIMALS = 15 as const

// пополняет так, чтобы на балансе было не меньше minRequiredOG + reserveOG
export async function ensureLedgerBalance(
  broker: any,
  { minRequiredOG, reserveOG }: { minRequiredOG?: number; reserveOG?: number } = {}
): Promise<void> {
  const envReserveDefault = Number(process.env.NEXT_PUBLIC_COMPUTE_RESERVE_OG ?? '0.05')
  const reserve = Number.isFinite(reserveOG) && (reserveOG as number) > 0 ? (reserveOG as number) : (Number.isFinite(envReserveDefault) && envReserveDefault > 0 ? envReserveDefault : 0.05)
  const feeRequired = Number.isFinite(minRequiredOG) && (minRequiredOG as number) > 0 ? (minRequiredOG as number) : 0

  try {
    const info = await broker.ledger.getLedger()
    const availableAtomic: bigint = info?.availableBalance ?? 0n
    const totalAtomic: bigint = info?.totalBalance ?? 0n

    const availableOG = Number(ethers.formatUnits(availableAtomic, LEDGER_DECIMALS))
    const needOG = feeRequired + reserve

    console.log(
      `available=${availableOG.toFixed(4)} OG, need>=${needOG.toFixed(4)} OG (fee=${feeRequired.toFixed(4)} OG, reserve=${reserve.toFixed(4)} OG)`
    )

    if (availableOG + 1e-12 < needOG) {
      const missingOG = Math.max(0, needOG - availableOG)

      if (totalAtomic === 0n) {
        // Аккаунт существует логически с total=0? Пополняем через addLedger
        const initAmountOG = missingOG
        const tx = await broker.ledger.addLedger(initAmountOG)
        if (tx && typeof tx.wait === 'function') {
          await tx.wait()
        }
      } else {
        const tx = await broker.ledger.depositFund(missingOG)
        if (tx && typeof tx.wait === 'function') {
          await tx.wait()
        }
      }

      const after = await broker.ledger.getLedger().catch(() => null)
      const afterAvailableOG = after ? Number(ethers.formatUnits(after?.availableBalance ?? 0n, LEDGER_DECIMALS)) : availableOG
      console.log(`toppedUp by ${missingOG.toFixed(4)} OG → available=${afterAvailableOG.toFixed(4)} OG`)
    }
  } catch (error: any) {
    const msg: string = error?.message || ''
    if (msg.includes('Account does not exist') || msg.includes('not exist')) {
      const needOG = (Number.isFinite(minRequiredOG) && (minRequiredOG as number) > 0 ? (minRequiredOG as number) : 0) + (Number.isFinite(reserveOG) && (reserveOG as number) > 0 ? (reserveOG as number) : (Number(process.env.NEXT_PUBLIC_COMPUTE_RESERVE_OG ?? '0.05') || 0.05))
      const initAmountOG = Math.max(needOG, 0.01)
      const tx = await broker.ledger.addLedger(initAmountOG)
      if (tx && typeof tx.wait === 'function') {
        await tx.wait()
      }
      const after = await broker.ledger.getLedger().catch(() => null)
      if (after) {
        const afterAvailableOG = Number(ethers.formatUnits(after?.availableBalance ?? 0n, LEDGER_DECIMALS))
        console.log(`available=${afterAvailableOG.toFixed(4)} OG`)
      }
      return
    }
    console.error('Failed to ensure ledger balance:', msg)
    throw error
  }
}

// Безопасный ACK с ожиданием receipt.status===1 если есть tx; кэшируем факт ACK
export async function acknowledgeProviderIfNeeded(broker: any, providerAddress: string): Promise<void> {
  const cacheKey = getAckCacheKey(broker, providerAddress)
  if (ackCache.has(cacheKey)) return

  let attemptedRecovery = false

  const doAck = async (): Promise<void> => {
    const tx = await broker.inference.acknowledgeProviderSigner(providerAddress)
    if (tx && typeof tx.wait === 'function') {
      const receipt = await tx.wait()
      const status = Number((receipt as any)?.status ?? 0)
      if (status === 1) {
        ackCache.add(cacheKey)
        console.log('ack=OK', { provider: providerAddress })
        return
      }
      throw new Error(`ack failed, receipt.status=${status}`)
    }
    // SDK 0.3.1 может не вернуть tx — считаем OK
    ackCache.add(cacheKey)
    console.log('ack=OK', { provider: providerAddress })
  }

  try {
    await doAck()
  } catch (e: any) {
    const msg: string = e?.message || ''
    if (msg.includes('already acknowledged')) {
      ackCache.add(cacheKey)
      console.log('ack=OK', { provider: providerAddress })
      return
    }
    if (!attemptedRecovery && msg.includes('Account does not exist')) {
      attemptedRecovery = true
      await ensureLedgerBalance(broker)
      await doAck()
      return
    }
    throw e
  }
}

export const __ackCache = ackCache
