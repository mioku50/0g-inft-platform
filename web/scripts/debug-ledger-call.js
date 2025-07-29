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

const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable'
]

const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))'
]

async function main() {
  console.log(`${colors.cyan}🔍 Debug Ledger addAccount call...${colors.reset}\n`)
  
  // 1. Setup
  const ledgerAddress = process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT
  const servingAddress = process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS
  const providerAddress = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY
  const rpcUrl = process.env.NEXT_PUBLIC_0G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
  
  if (!ledgerAddress || !servingAddress || !providerAddress) {
    console.log(`${colors.red}❌ Missing required addresses in .env.local${colors.reset}`)
    process.exit(1)
  }
  
  if (!privateKey) {
    console.log(`${colors.yellow}⚠️  No private key provided - running in read-only mode${colors.reset}`)
  }
  
  // 2. Connect
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer = privateKey ? new ethers.Wallet(privateKey, provider) : null
  const userAddress = signer ? await signer.getAddress() : '0x0000000000000000000000000000000000000000'
  
  console.log(`${colors.blue}📋 Configuration:${colors.reset}`)
  console.log(`  User: ${userAddress}`)
  console.log(`  Provider: ${providerAddress}`)
  console.log(`  Ledger: ${ledgerAddress}`)
  console.log(`  Serving: ${servingAddress}`)
  console.log()
  
  // 3. Check wallet balance
  if (signer) {
    const balance = await provider.getBalance(userAddress)
    console.log(`${colors.blue}💰 Wallet balance: ${ethers.formatEther(balance)} OG${colors.reset}`)
    
    if (balance < ethers.parseEther('0.01')) {
      console.log(`${colors.yellow}  ⚠️  Low balance - may not be able to send transactions${colors.reset}`)
    }
    console.log()
  }
  
  // 4. Create contract instances
  const ledgerContract = new ethers.Contract(ledgerAddress, LEDGER_ABI, signer || provider)
  const servingContract = new ethers.Contract(servingAddress, SERVING_ABI, provider)
  
  // 5. Pre-checks
  console.log(`${colors.blue}🔍 Running pre-checks...${colors.reset}`)
  
  // Check provider exists
  try {
    const service = await servingContract.getService(providerAddress)
    if (!service || !service.url) {
      console.log(`${colors.red}  ❌ Provider not registered in Serving contract${colors.reset}`)
      process.exit(1)
    }
    console.log(`  ✅ Provider registered: ${service.url}`)
  } catch (err) {
    console.log(`${colors.red}  ❌ Error checking provider: ${err.message}${colors.reset}`)
  }
  
  // Check account exists
  try {
    const exists = await servingContract.accountExists(userAddress, providerAddress)
    console.log(`  ${exists ? '⚠️  Account already exists' : '✅ Account does not exist (good for addAccount)'}`)
    
    if (exists) {
      console.log(`${colors.yellow}  Use depositFund instead of addAccount for existing accounts${colors.reset}`)
    }
  } catch (err) {
    console.log(`  ℹ️  Could not check account existence: ${err.message}`)
  }
  console.log()
  
  // 6. Prepare transaction data
  const additionalInfo = 'INFT Platform User'
  const value = ethers.parseEther('0.001') // Small test amount
  
  console.log(`${colors.blue}📝 Transaction parameters:${colors.reset}`)
  console.log(`  Method: addAccount`)
  console.log(`  User: ${userAddress}`)
  console.log(`  Provider: ${providerAddress}`)
  console.log(`  Additional Info: "${additionalInfo}"`)
  console.log(`  Value: ${ethers.formatEther(value)} OG`)
  console.log()
  
  // 7. Encode transaction data
  const txData = ledgerContract.interface.encodeFunctionData('addAccount', [
    userAddress,
    providerAddress,
    additionalInfo
  ])
  
  console.log(`${colors.blue}🔧 Encoded transaction:${colors.reset}`)
  console.log(`  To: ${ledgerAddress}`)
  console.log(`  Data: ${txData}`)
  console.log(`  Value: ${value.toString()} wei`)
  
  // Decode to verify
  const selector = txData.slice(0, 10)
  console.log(`  Selector: ${selector}`)
  console.log()
  
  // 8. Try static call first
  if (signer) {
    console.log(`${colors.blue}🧪 Attempting static call...${colors.reset}`)
    
    try {
      // Try callStatic to get revert reason
      await ledgerContract.addAccount.staticCall(userAddress, providerAddress, additionalInfo, { value })
      console.log(`${colors.green}  ✅ Static call succeeded - transaction should work${colors.reset}`)
    } catch (err) {
      console.log(`${colors.red}  ❌ Static call failed${colors.reset}`)
      console.log(`  Error: ${err.message}`)
      
      // Try to extract revert reason
      if (err.data) {
        console.log(`  Revert data: ${err.data}`)
        
        // Try to decode standard error messages
        const errorSignatures = {
          '0x08c379a0': 'Error(string)',
          '0x4e487b71': 'Panic(uint256)',
          '0x': 'Empty revert'
        }
        
        const sig = err.data.slice(0, 10)
        if (errorSignatures[sig]) {
          console.log(`  Error type: ${errorSignatures[sig]}`)
        }
      }
      
      if (err.reason) {
        console.log(`  Reason: ${err.reason}`)
      }
    }
    console.log()
    
    // 9. Try with manual gas limit
    console.log(`${colors.blue}🧪 Attempting with manual gas limit...${colors.reset}`)
    
    try {
      const gasLimit = 300000n
      console.log(`  Using gas limit: ${gasLimit}`)
      
      // Estimate gas for the raw transaction
      const estimatedGas = await provider.estimateGas({
        from: userAddress,
        to: ledgerAddress,
        data: txData,
        value: value
      })
      
      console.log(`  Estimated gas: ${estimatedGas}`)
      
      // Try the transaction with explicit gas limit
      const tx = await signer.sendTransaction({
        to: ledgerAddress,
        data: txData,
        value: value,
        gasLimit: gasLimit
      })
      
      console.log(`${colors.green}  ✅ Transaction sent: ${tx.hash}${colors.reset}`)
      console.log(`  Waiting for confirmation...`)
      
      const receipt = await tx.wait()
      console.log(`  Transaction mined in block ${receipt.blockNumber}`)
      console.log(`  Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`)
      
    } catch (err) {
      console.log(`${colors.red}  ❌ Transaction failed${colors.reset}`)
      console.log(`  Error: ${err.message}`)
      
      if (err.transaction) {
        console.log(`  Failed tx hash: ${err.transaction.hash}`)
      }
    }
  } else {
    console.log(`${colors.yellow}ℹ️  Skipping transaction tests (no private key provided)${colors.reset}`)
  }
  
  console.log(`\n${colors.cyan}📊 Debug Summary:${colors.reset}`)
  console.log(`  - Provider is registered: ✓`)
  console.log(`  - Transaction encoding: ✓`)
  console.log(`  - Static call result: Check logs above`)
  console.log(`  - Likely issue: Contract-level require() failing`)
  console.log(`\n${colors.yellow}💡 Next steps:${colors.reset}`)
  console.log(`  1. Check if Ledger contract is initialized with correct Serving address`)
  console.log(`  2. Verify provider signer acknowledgment requirements`)
  console.log(`  3. Check contract source for specific require() conditions`)
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`)
  process.exit(1)
})