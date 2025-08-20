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
