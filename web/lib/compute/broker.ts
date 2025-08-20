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

function getAddressesFromEnv() {
  return {
    ledgerManagerAddress: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT!,
    inferenceServingAddress: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT!,
    fineTuningServingAddress: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS!,
  }
}

// Унифицированный конструктор: пробуем modern → legacy
export async function createBrokerWithEnvPK() {
  const create = await loadCreateFn()

  const provider = getServerProvider()
  const pk = process.env.OG_COMPUTE_PRIVATE_KEY || process.env.OG_STORAGE_PRIVATE_KEY
  if (!pk) throw new Error('Missing OG_COMPUTE_PRIVATE_KEY/OG_STORAGE_PRIVATE_KEY')
  const wallet = new ethers.Wallet(pk, provider)

  const addrs = getAddressesFromEnv()

  // 1) Попытка modern-сигнатуры (с правильными ключами)
  try {
    // Modern: ensure we pass exactly expected keys
    const broker = await create(wallet, {
      ledgerManagerAddress: addrs.ledgerManagerAddress,
      inferenceServingAddress: addrs.inferenceServingAddress,
      fineTuningServingAddress: addrs.fineTuningServingAddress,
    })
    // быстрый runtime-check: убеждаемся, что контракты подхватились
    if (!broker?.inference || !broker?.ledger) {
      throw new Error('Broker missing inference/ledger after modern init')
    }
    return broker
  } catch (e: any) {
    console.log('[broker] modern init failed → fallback to legacy:', e?.message)
  }

  // 2) Legacy: без адресов (SDK сам знает тестнет-адреса) ИЛИ с другими именами ключей
  try {
    const broker = await create(wallet)
    // если у объекта есть setters — подставим адреса вручную
    if (broker?.inference?.setContractAddresses) {
      await broker.inference.setContractAddresses({ inferenceServingAddress: addrs.inferenceServingAddress })
    }
    if (broker?.ledger?.setContractAddress) {
      await broker.ledger.setContractAddress(addrs.ledgerManagerAddress)
    }
    if (broker?.fineTuning?.setContractAddresses && addrs.fineTuningServingAddress) {
      await broker.fineTuning.setContractAddresses({ fineTuningServingAddress: addrs.fineTuningServingAddress })
    }
    return broker
  } catch (e: any) {
    console.error('[broker] legacy init also failed:', e?.message)
    throw e
  }
}
