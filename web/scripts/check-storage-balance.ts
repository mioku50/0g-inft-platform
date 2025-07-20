// web/scripts/check-storage-balance.ts
import { ethers } from 'ethers'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') })

const RPC_URL = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
const STORAGE_PRIVATE_KEY = process.env.OG_STORAGE_PRIVATE_KEY
const COMPUTE_PRIVATE_KEY = process.env.OG_COMPUTE_PRIVATE_KEY
const USER_PRIVATE_KEY = process.env.PRIVATE_KEY // Your main wallet

async function checkBalances() {
  console.log('=== 0G Wallet Balance Check ===\n')
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  
  // Check network
  const network = await provider.getNetwork()
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`)
  console.log(`RPC URL: ${RPC_URL}\n`)
  
  // Check storage wallet
  if (STORAGE_PRIVATE_KEY) {
    const storageWallet = new ethers.Wallet(STORAGE_PRIVATE_KEY, provider)
    const storageBalance = await provider.getBalance(storageWallet.address)
    
    console.log('📦 Storage Wallet:')
    console.log(`  Address: ${storageWallet.address}`)
    console.log(`  Balance: ${ethers.formatEther(storageBalance)} OG`)
    console.log(`  Status: ${parseFloat(ethers.formatEther(storageBalance)) >= 0.5 ? '✅ Sufficient' : '❌ Low balance (need >= 0.5 OG)'}`)
    console.log()
  } else {
    console.log('❌ Storage wallet not configured (OG_STORAGE_PRIVATE_KEY missing)\n')
  }
  
  // Check compute wallet
  if (COMPUTE_PRIVATE_KEY) {
    const computeWallet = new ethers.Wallet(COMPUTE_PRIVATE_KEY, provider)
    const computeBalance = await provider.getBalance(computeWallet.address)
    
    console.log('🤖 Compute Wallet:')
    console.log(`  Address: ${computeWallet.address}`)
    console.log(`  Balance: ${ethers.formatEther(computeBalance)} OG`)
    console.log(`  Status: ${parseFloat(ethers.formatEther(computeBalance)) >= 0.1 ? '✅ Sufficient' : '❌ Low balance (need >= 0.1 OG)'}`)
    console.log()
  } else {
    console.log('❌ Compute wallet not configured (OG_COMPUTE_PRIVATE_KEY missing)\n')
  }
  
  // Check user wallet
  if (USER_PRIVATE_KEY) {
    const userWallet = new ethers.Wallet(USER_PRIVATE_KEY, provider)
    const userBalance = await provider.getBalance(userWallet.address)
    
    console.log('👤 User Wallet:')
    console.log(`  Address: ${userWallet.address}`)
    console.log(`  Balance: ${ethers.formatEther(userBalance)} OG`)
    console.log()
  }
  
  // Get current gas price
  const feeData = await provider.getFeeData()
  console.log('⛽ Network Gas Price:')
  console.log(`  Current: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei`)
  console.log()
}

async function fundStorageWallet(amountInEther: string) {
  if (!USER_PRIVATE_KEY || !STORAGE_PRIVATE_KEY) {
    console.error('❌ Missing private keys for funding')
    return
  }
  
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const userWallet = new ethers.Wallet(USER_PRIVATE_KEY, provider)
  const storageWallet = new ethers.Wallet(STORAGE_PRIVATE_KEY, provider)
  
  console.log(`\n💸 Funding storage wallet...`)
  console.log(`  From: ${userWallet.address}`)
  console.log(`  To: ${storageWallet.address}`)
  console.log(`  Amount: ${amountInEther} OG`)
  
  try {
    const tx = await userWallet.sendTransaction({
      to: storageWallet.address,
      value: ethers.parseEther(amountInEther)
    })
    
    console.log(`  TX Hash: ${tx.hash}`)
    console.log('  Waiting for confirmation...')
    
    const receipt = await tx.wait()
    console.log(`  ✅ Confirmed in block ${receipt?.blockNumber}`)
    
    // Check new balance
    const newBalance = await provider.getBalance(storageWallet.address)
    console.log(`  New storage wallet balance: ${ethers.formatEther(newBalance)} OG`)
    
  } catch (error) {
    console.error('❌ Funding failed:', error)
  }
}

// Run the script
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  
  if (command === 'fund' && args[1]) {
    await fundStorageWallet(args[1])
  } else {
    await checkBalances()
    
    console.log('📌 Usage:')
    console.log('  Check balances: npm run check-balance')
    console.log('  Fund storage wallet: npm run check-balance fund 0.5')
    console.log('\n🔗 Get testnet OG tokens: https://faucet.0g.ai')
  }
}

main().catch(console.error)

// package.json - добавьте в scripts
/*
"scripts": {
  "check-balance": "ts-node scripts/check-storage-balance.ts",
  "fund-storage": "ts-node scripts/check-storage-balance.ts fund"
}
*/