// scripts/health-check.ts
export {}
const { ethers } = require('ethers')
const dotenv = require('dotenv')

// Import the broker functions from our updated module
import { createBroker } from '../lib/compute/broker'

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
    console.log(`✅ Connected to 0G network (block: ${blockNumber})`)
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
  
  // Check compute broker initialization
  if (process.argv[2] === 'init-compute') {
    console.log('\n🤖 Initializing compute broker...')
    try {
      const wallet = new ethers.Wallet(process.env.OG_COMPUTE_PRIVATE_KEY!, provider)
      const broker = await createBroker(wallet, {
        ledger: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT!,
        inference: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT!,
        fineTuning: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS!
      })
      
      // Check if account exists
      const account = await broker.ledger.getAccount(wallet.address)
      if (!account || account[0] === BigInt(0)) {
        console.log('📝 Creating compute account...')
        await broker.ledger.addLedger(0.01) // 0.01 OG initial deposit
        console.log('✅ Compute account created!')
      } else {
        console.log('✅ Compute account already exists')
        const balance = ethers.formatEther(account[0])
        console.log(`   Balance: ${balance} OG`)
      }
    } catch (error) {
      console.error('❌ Failed to initialize compute:', error)
      issues.push('❌ Compute initialization failed')
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