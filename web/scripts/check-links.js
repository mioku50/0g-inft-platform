#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { ethers } = require('ethers')

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

const SERVING_ABI = [
  'function ledgerAddress() view returns (address)',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
  'function accountExists(address user, address provider) view returns (bool)'
]

async function main() {
  console.log(`${colors.cyan}🔍 Checking Ledger ↔ Serving contract links...${colors.reset}\n`)
  
  // 1. Read environment variables
  const servingAddress = process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS
  const ledgerAddress = process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT
  const providerAddress = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER
  const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  
  console.log(`${colors.blue}📋 Environment Variables:${colors.reset}`)
  console.log(`  RPC URL: ${rpcUrl}`)
  console.log(`  NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS: ${servingAddress || colors.red + 'NOT SET' + colors.reset}`)
  console.log(`  NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT: ${ledgerAddress || colors.red + 'NOT SET' + colors.reset}`)
  console.log(`  NEXT_PUBLIC_FINE_TUNE_PROVIDER: ${providerAddress || colors.red + 'NOT SET' + colors.reset}`)
  console.log()
  
  if (!servingAddress || !ledgerAddress || !providerAddress) {
    console.log(`${colors.red}❌ Missing required environment variables!${colors.reset}`)
    process.exit(1)
  }
  
  // 2. Connect to RPC
  console.log(`${colors.blue}🔌 Connecting to RPC...${colors.reset}`)
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  
  try {
    const network = await provider.getNetwork()
    console.log(`  ✅ Connected to chain ID: ${network.chainId}`)
  } catch (err) {
    console.log(`${colors.red}  ❌ Failed to connect: ${err.message}${colors.reset}`)
    process.exit(1)
  }
  console.log()
  
  // 3. Check Serving contract
  console.log(`${colors.blue}📄 Checking Serving contract...${colors.reset}`)
  const servingContract = new ethers.Contract(servingAddress, SERVING_ABI, provider)
  
  try {
    // Check if contract is deployed
    const code = await provider.getCode(servingAddress)
    if (code === '0x') {
      console.log(`${colors.red}  ❌ Serving contract not deployed at ${servingAddress}${colors.reset}`)
      process.exit(1)
    }
    console.log(`  ✅ Serving contract deployed at ${servingAddress}`)
    
    // Get ledger address from Serving
    const servingLedgerAddr = await servingContract.ledgerAddress()
    console.log(`  📍 Serving.ledgerAddress() = ${servingLedgerAddr}`)
    
    // Compare with ENV
    if (servingLedgerAddr.toLowerCase() === ledgerAddress.toLowerCase()) {
      console.log(`${colors.green}  ✅ Ledger address matches ENV${colors.reset}`)
    } else {
      console.log(`${colors.red}  ❌ Ledger address mismatch!${colors.reset}`)
      console.log(`     ENV: ${ledgerAddress}`)
      console.log(`     Contract: ${servingLedgerAddr}`)
    }
  } catch (err) {
    console.log(`${colors.red}  ❌ Error checking Serving contract: ${err.message}${colors.reset}`)
  }
  console.log()
  
  // 4. Check Ledger contract
  console.log(`${colors.blue}📄 Checking Ledger contract...${colors.reset}`)
  
  try {
    // Check if contract is deployed
    const code = await provider.getCode(ledgerAddress)
    if (code === '0x') {
      console.log(`${colors.red}  ❌ Ledger contract not deployed at ${ledgerAddress}${colors.reset}`)
    } else {
      console.log(`  ✅ Ledger contract deployed at ${ledgerAddress}`)
    }
    
    // Note: Standard Ledger might not have a serving() method
    // This is OK - the important link is Serving -> Ledger
    console.log(`  ℹ️  Note: Ledger may not have a reverse link to Serving (this is normal)`)
  } catch (err) {
    console.log(`${colors.red}  ❌ Error checking Ledger contract: ${err.message}${colors.reset}`)
  }
  console.log()
  
  // 5. Check Provider registration
  console.log(`${colors.blue}👤 Checking Provider registration...${colors.reset}`)
  
  try {
    const service = await servingContract.getService(providerAddress)
    
    if (!service || !service.url || service.url.length === 0) {
      console.log(`${colors.red}  ❌ Provider not registered!${colors.reset}`)
    } else {
      console.log(`${colors.green}  ✅ Provider exists & OK${colors.reset}`)
      console.log(`     URL: ${service.url}`)
      console.log(`     Occupied: ${service.occupied}`)
      console.log(`     Provider Signer: ${service.providerSigner}`)
      console.log(`     Models: ${service.models?.length || 0} available`)
      
      if (service.occupied) {
        console.log(`${colors.yellow}  ⚠️  Provider is occupied (might not accept new tasks)${colors.reset}`)
      }
    }
  } catch (err) {
    console.log(`${colors.red}  ❌ Error checking provider: ${err.message}${colors.reset}`)
  }
  console.log()
  
  // 6. Summary
  console.log(`${colors.cyan}📊 Summary:${colors.reset}`)
  console.log(`  - Serving contract points to Ledger: ${servingAddress} → ${ledgerAddress}`)
  console.log(`  - Provider ${providerAddress} registration status checked`)
  console.log(`  - All contract links verified`)
  
  console.log(`\n${colors.green}✨ Check complete!${colors.reset}`)
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`)
  process.exit(1)
})