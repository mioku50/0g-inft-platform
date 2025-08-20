// scripts/check-inference.ts
export {}
import { ethers } from 'ethers'
import 'dotenv/config'
import { createBrokerWithEnvPK } from '../lib/compute/broker'

async function main() {
  // Ensure env
  process.env.NEXT_PUBLIC_0G_RPC_URL ||= process.env.NEXT_PUBLIC_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  // Fallback valid test key if .env.local is broken by line wraps
  process.env.OG_COMPUTE_PRIVATE_KEY ||= '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'

  const broker = await createBrokerWithEnvPK()

  // Ledger
  const ledger = await broker.ledger.getLedger()
  const available = ledger?.availableBalance ?? 0n
  console.log(`available=${Number(ethers.formatEther(available)).toFixed(4)}`)
  if (available === 0n) {
    await broker.ledger.addLedger(0.05)
    const after = await broker.ledger.getLedger()
    console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)}`)
  } else if (Number(ethers.formatEther(available)) < 0.01) {
    await broker.ledger.depositFund(0.05)
    const after = await broker.ledger.getLedger()
    console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)}`)
  }

  // list services
  const services = await broker.inference.listService()
  console.log(`listService() -> ${services.length}`)
  if (!services.length) {
    throw new Error('No services')
  }

  // Pick first
  const service = services[0]
  const userMessage = 'Say hello in one short sentence.'

  // acknowledge → metadata → headers → fetch
  try {
    const ackTx = await broker.inference.acknowledgeProviderSigner(service.provider)
    if (ackTx && typeof (ackTx as any).wait === 'function') {
      const receipt = await (ackTx as any).wait()
      if (Number(receipt?.status || 0) !== 1) {
        throw new Error('ack failed')
      }
    }
    console.log('ack=OK', { provider: service.provider })
  } catch (e: any) {
    if ((e?.message || '').includes('Account does not exist')) {
      // fund and retry once
      await broker.ledger.addLedger(0.05)
      const ackTx = await broker.inference.acknowledgeProviderSigner(service.provider)
      if (ackTx && typeof (ackTx as any).wait === 'function') {
        const receipt = await (ackTx as any).wait()
        if (Number(receipt?.status || 0) !== 1) throw new Error('ack failed after retry')
      }
      console.log('ack=OK', { provider: service.provider })
    } else {
      throw e
    }
  }

  const { endpoint, model } = await broker.inference.getServiceMetadata(service.provider)
  console.log('metadata=OK', { provider: service.provider, model })

  const headers = await broker.inference.getRequestHeaders(service.provider, userMessage)
  console.log('headers=OK')

  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a concise assistant.' },
      { role: 'user', content: userMessage },
    ],
    stream: false,
  }

  const resp = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }
  const data: any = await resp.json()
  const content = data?.choices?.[0]?.message?.content || ''
  console.log('isRealAI:true', { provider: service.provider, model })
  console.log('content:', content?.slice(0, 80))
}

main().catch(err => {
  console.error('check-inference failed:', err?.message)
  process.exit(1)
})

