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

// Обеспечиваем наличие и баланс леджера. Если minTopUpOG задан, пополняем минимум на эту сумму.
export async function ensureLedgerBalance(broker: any, minTopUpOG?: number): Promise<void> {
  try {
    const info = await broker.ledger.getLedger()
    const available = info?.availableBalance ?? 0n
    const total = info?.totalBalance ?? 0n

    console.log(`available=${Number(ethers.formatEther(available)).toFixed(4)} OG`)

    // Рассчитываем желаемую сумму пополнения
    const defaultTopUp = 0.05
    const desiredTopUp = typeof minTopUpOG === 'number' && isFinite(minTopUpOG) && minTopUpOG > 0 ? minTopUpOG : defaultTopUp

    if (available === 0n) {
      try {
        await broker.ledger.addLedger(desiredTopUp)
        const after = await broker.ledger.getLedger()
        console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
      } catch (e: any) {
        await broker.ledger.depositFund(desiredTopUp)
        const after = await broker.ledger.getLedger()
        console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
      }
    } else {
      const availableFloat = Number(ethers.formatEther(available))
      if (availableFloat < 0.01) {
        await broker.ledger.depositFund(desiredTopUp)
        const after = await broker.ledger.getLedger()
        console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
      }
    }
  } catch (error: any) {
    const msg: string = error?.message || ''
    if (msg.includes('Account does not exist') || msg.includes('not exist')) {
      const defaultTopUp = 0.05
      const desiredTopUp = typeof minTopUpOG === 'number' && isFinite(minTopUpOG) && minTopUpOG > 0 ? minTopUpOG : defaultTopUp
      await broker.ledger.addLedger(desiredTopUp)
      const after = await broker.ledger.getLedger().catch(() => null)
      if (after) {
        console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
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
