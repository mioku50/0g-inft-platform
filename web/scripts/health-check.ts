// scripts/health-check.ts
export {}
const { ethers } = require('ethers')
const dotenv = require('dotenv')

// Import the broker constructor
import { createBrokerWithEnvPK } from '../lib/compute/broker'

dotenv.config({ path: '.env' })

async function checkSystemHealth() {
  console.log('🏥 0G INFT Platform Health Check\n')
  
  const issues: string[] = []
  
  // Check environment variables
  console.log('📋 Checking environment variables...')
  const requiredEnvVars = [
    'NEXT_PUBLIC_0G_RPC_URL',
    'NEXT_PUBLIC_INFT_CONTRACT_ADDRESS',
    'NEXT_PUBLIC_0G_STORAGE_URL',
    'OG_STORAGE_PRIVATE_KEY',
    'OG_COMPUTE_PRIVATE_KEY'
  ]
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`❌ Missing ${envVar}`)
    } else {
      console.log(`✅ ${envVar} is set`)
    }
  }
  
  // Check network connection
  console.log('\n🌐 Checking network connection...')
  try {
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
    const blockNumber = await provider.getBlockNumber()
    const net = await provider.getNetwork()
    const chainId = Number(net.chainId)
    console.log(`✅ Connected to 0G network (chainId=${chainId}, block=${blockNumber})`)
  } catch (error) {
    issues.push('❌ Cannot connect to 0G network')
    console.error('❌ Network error:', error)
  }
  
  // Check wallet balances
  console.log('\n💰 Checking wallet balances...')
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_0G_RPC_URL)
  
  // Storage wallet
  if (process.env.OG_STORAGE_PRIVATE_KEY) {
    try {
      const wallet = new ethers.Wallet(process.env.OG_STORAGE_PRIVATE_KEY, provider)
      const balance = await provider.getBalance(wallet.address)
      const balanceInOG = ethers.formatEther(balance)
      console.log(`📦 Storage wallet: ${wallet.address}`)
      console.log(`   Balance: ${balanceInOG} OG`)
      
      if (parseFloat(balanceInOG) < 0.1) {
        issues.push(`⚠️  Storage wallet balance low: ${balanceInOG} OG (recommend >= 0.1 OG)`)
      }
    } catch (error) {
      issues.push('❌ Invalid storage wallet private key')
    }
  }
  
  // Compute wallet
  if (process.env.OG_COMPUTE_PRIVATE_KEY) {
    try {
      const wallet = new ethers.Wallet(process.env.OG_COMPUTE_PRIVATE_KEY, provider)
      const balance = await provider.getBalance(wallet.address)
      const balanceInOG = ethers.formatEther(balance)
      console.log(`🧠 Compute wallet: ${wallet.address}`)
      console.log(`   Balance: ${balanceInOG} OG`)
      
      if (parseFloat(balanceInOG) < 0.1) {
        issues.push(`⚠️  Compute wallet balance low: ${balanceInOG} OG (recommend >= 0.1 OG)`)
      }
    } catch (error) {
      issues.push('❌ Invalid compute wallet private key')
    }
  }
  
  // Compute broker and services overview
  console.log('\n🤖 Checking compute broker and services...')
  try {
    const broker = await createBrokerWithEnvPK()
    const services = await broker.inference.listService()
    console.log(`services=${services.length}`)
    // Ledger available
    try {
      const ledger = await broker.ledger.getLedger()
      const available = ledger?.availableBalance ?? 0n
      console.log(`available=${Number(ethers.formatEther(available)).toFixed(4)} OG`)
    } catch (e: any) {
      const msg: string = e?.message || ''
      if (msg.includes('Account does not exist')) {
        console.log('available=0.0000 OG')
      } else {
        throw e
      }
    }
  } catch (error) {
    console.error('❌ Compute check failed:', error)
    issues.push('❌ Compute check failed')
  }

  // Optional: initialize/fund compute account if requested
  if (process.argv[2] === 'init-compute') {
    console.log('\n🛠 Funding compute account...')
    try {
      const broker = await createBrokerWithEnvPK()
      const ledger = await broker.ledger.getLedger().catch(() => null)
      const available = ledger?.availableBalance ?? 0n
      if (available === 0n) {
        await broker.ledger.addLedger(0.05)
      } else if (Number(ethers.formatEther(available)) < 0.01) {
        await broker.ledger.depositFund(0.05)
      }
      const after = await broker.ledger.getLedger()
      console.log(`available=${Number(ethers.formatEther(after?.availableBalance ?? 0n)).toFixed(4)} OG`)
    } catch (error) {
      console.error('❌ Failed to fund compute:', error)
      issues.push('❌ Compute funding failed')
    }
  }
  
  // Summary
  console.log('\n📊 Health Check Summary:')
  if (issues.length === 0) {
    console.log('✅ All systems operational!')
  } else {
    console.log(`⚠️  Found ${issues.length} issues:\n`)
    issues.forEach(issue => console.log(issue))
  }
  
  if (issues.some(i => i.includes('balance low'))) {
    console.log('\n💡 Get testnet OG tokens at: https://faucet.0g.ai')
  }
}

checkSystemHealth().catch(console.error)
