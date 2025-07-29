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

// Extended Ledger ABI to check for serving address
const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function serving() view returns (address)', // Common pattern
  'function servingContract() view returns (address)', // Alternative naming
  'function fineTuningServing() view returns (address)', // Alternative naming
  'function getServing() view returns (address)', // Alternative naming
]

async function main() {
  console.log(`${colors.cyan}🔍 Checking Ledger → Serving link...${colors.reset}\n`)
  
  const ledgerAddress = process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT
  const servingAddress = process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS
  const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  
  if (!ledgerAddress || !servingAddress) {
    console.log(`${colors.red}❌ Missing required addresses${colors.reset}`)
    process.exit(1)
  }
  
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const ledgerContract = new ethers.Contract(ledgerAddress, LEDGER_ABI, provider)
  
  console.log(`${colors.blue}📋 Configuration:${colors.reset}`)
  console.log(`  Ledger: ${ledgerAddress}`)
  console.log(`  Expected Serving: ${servingAddress}`)
  console.log()
  
  console.log(`${colors.blue}🔍 Checking Ledger contract for Serving reference...${colors.reset}`)
  
  // Try different method names to find serving address
  const methodsToTry = ['serving', 'servingContract', 'fineTuningServing', 'getServing']
  let foundServingAddress = null
  let foundMethod = null
  
  for (const method of methodsToTry) {
    try {
      const result = await ledgerContract[method]()
      if (result && result !== ethers.ZeroAddress) {
        foundServingAddress = result
        foundMethod = method
        break
      }
    } catch (err) {
      // Method doesn't exist, continue
    }
  }
  
  if (foundServingAddress) {
    console.log(`  ✅ Found serving address via ${foundMethod}(): ${foundServingAddress}`)
    
    if (foundServingAddress.toLowerCase() === servingAddress.toLowerCase()) {
      console.log(`${colors.green}  ✅ Ledger knows correct Serving address!${colors.reset}`)
    } else {
      console.log(`${colors.red}  ❌ Ledger has wrong Serving address!${colors.reset}`)
      console.log(`     Expected: ${servingAddress}`)
      console.log(`     Actual: ${foundServingAddress}`)
    }
  } else {
    console.log(`${colors.yellow}  ⚠️  Could not find Serving address in Ledger contract${colors.reset}`)
    console.log(`  This might mean:`)
    console.log(`  1. Ledger uses a different method name`)
    console.log(`  2. Ledger is not initialized with Serving address`)
    console.log(`  3. This is a generic Ledger without Serving integration`)
  }
  
  console.log()
  console.log(`${colors.cyan}💡 Hypothesis:${colors.reset}`)
  console.log(`  The Ledger contract at ${ledgerAddress} might be:`)
  console.log(`  1. A generic compute ledger not specifically for FineTuningServing`)
  console.log(`  2. Not initialized with the FineTuningServing address`)
  console.log(`  3. Using a different integration pattern`)
  console.log()
  console.log(`${colors.yellow}🔧 Possible solutions:${colors.reset}`)
  console.log(`  1. Deploy a FineTuning-specific Ledger that knows about FineTuningServing`)
  console.log(`  2. Initialize the current Ledger with FineTuningServing address`)
  console.log(`  3. Use a different Ledger address that's properly configured`)
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`)
  process.exit(1)
})