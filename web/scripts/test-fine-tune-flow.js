#!/usr/bin/env node

/**
 * Fine-tune Flow Diagnostic & Testing Script
 * 
 * Usage:
 *   node scripts/test-fine-tune-flow.js [options]
 * 
 * Options:
 *   --simulate-only    Only run simulations, don't send transactions
 *   --send-tx         Actually send transactions (requires private key)
 *   --provider <addr>  Override provider address
 *   --amount <value>   Deposit amount in OG (default: 0.01)
 */

const { ethers } = require('ethers')
const fs = require('fs')
const path = require('path')

// Load environment
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function getService(address provider) view returns (tuple(address provider,string url,tuple(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
  'function addAccount(address user, address provider, string additionalInfo) payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable'
]

class FineTuneFlowTester {
  constructor() {
    this.config = this.loadConfig()
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
    this.signer = this.config.privateKey ? new ethers.Wallet(this.config.privateKey, this.provider) : null
  }

  loadConfig() {
    const config = {
      rpcUrl: process.env.OG_RPC_URL || process.env.NEXT_PUBLIC_0G_RPC_URL,
      servingAddress: process.env.FINE_TUNING_SERVING_ADDRESS || process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS,
      ledgerAddress: process.env.COMPUTE_LEDGER_CONTRACT || process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT,
      inferenceAddress: process.env.COMPUTE_INFERENCE_CONTRACT || process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT,
      providerAddress: process.env.FINE_TUNE_PROVIDER || process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER,
      privateKey: process.env.OG_COMPUTE_PRIVATE_KEY
    }

    // Validate required fields
    const required = ['rpcUrl', 'servingAddress', 'providerAddress']
    const missing = required.filter(key => !config[key])
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing)
      process.exit(1)
    }

    return config
  }

  async printEnvironmentInfo() {
    console.log('🔍 Environment Configuration')
    console.log('=' .repeat(50))
    
    try {
      const network = await this.provider.getNetwork()
      const chainId = Number(network.chainId)
      console.log(`Network: ${network.name || 'Unknown'} (Chain ID: ${chainId})`)
    } catch (error) {
      console.log(`❌ RPC Connection Failed: ${error.message}`)
      return false
    }

    console.log(`RPC URL: ${this.config.rpcUrl}`)
    console.log(`FineTuningServing: ${this.config.servingAddress}`)
    console.log(`Ledger Contract: ${this.config.ledgerAddress || 'Not set'}`)
    console.log(`Inference Contract: ${this.config.inferenceAddress || 'Not set'}`)
    console.log(`Provider Address: ${this.config.providerAddress}`)
    console.log(`Has Private Key: ${!!this.config.privateKey}`)
    
    if (this.signer) {
      console.log(`Wallet Address: ${this.signer.address}`)
      try {
        const balance = await this.provider.getBalance(this.signer.address)
        console.log(`Wallet Balance: ${ethers.formatEther(balance)} OG`)
      } catch (error) {
        console.log(`❌ Failed to get wallet balance: ${error.message}`)
      }
    }

    console.log()
    return true
  }

  async validateContracts() {
    console.log('🔍 Contract Validation')
    console.log('=' .repeat(50))

    const contracts = [
      { name: 'FineTuningServing', address: this.config.servingAddress },
      { name: 'Ledger', address: this.config.ledgerAddress },
      { name: 'Inference', address: this.config.inferenceAddress }
    ]

    let allValid = true

    for (const contract of contracts) {
      if (!contract.address) {
        console.log(`⚠️  ${contract.name}: Not configured`)
        continue
      }

      try {
        const code = await this.provider.getCode(contract.address)
        if (code === '0x') {
          console.log(`❌ ${contract.name}: No contract deployed at ${contract.address}`)
          allValid = false
        } else {
          console.log(`✅ ${contract.name}: Contract deployed (${code.length} bytes)`)
        }
      } catch (error) {
        console.log(`❌ ${contract.name}: Validation failed - ${error.message}`)
        allValid = false
      }
    }

    console.log()
    return allValid
  }

  async testProviderRegistration() {
    console.log('🔍 Provider Registration Check')
    console.log('=' .repeat(50))

    try {
      const servingContract = new ethers.Contract(this.config.servingAddress, SERVING_ABI, this.provider)
      const service = await servingContract.getService(this.config.providerAddress)
      
      console.log(`Provider: ${this.config.providerAddress}`)
      console.log(`URL: ${service.url || 'Not set'}`)
      console.log(`Occupied: ${service.occupied}`)
      console.log(`Models: ${service.models?.length || 0} models`)
      console.log(`Price per Token: ${ethers.formatEther(service.pricePerToken || 0)} OG`)
      console.log(`Provider Signer: ${service.providerSigner}`)

      if (!service.url || service.url.length === 0) {
        console.log('❌ Provider is not properly registered (no URL)')
        return false
      }

      console.log('✅ Provider is registered and available')
      console.log()
      return true
    } catch (error) {
      console.log(`❌ Provider registration check failed: ${error.message}`)
      console.log()
      return false
    }
  }

  async checkAccountStatus(userAddress) {
    console.log('🔍 Account Status Check')
    console.log('=' .repeat(50))

    try {
      const servingContract = new ethers.Contract(this.config.servingAddress, SERVING_ABI, this.provider)
      
      const exists = await servingContract.accountExists(userAddress, this.config.providerAddress)
      console.log(`Account exists: ${exists}`)

      if (exists) {
        const account = await servingContract.getAccount(userAddress, this.config.providerAddress)
        console.log(`Balance: ${ethers.formatEther(account.balance)} OG`)
        console.log(`Pending Refund: ${ethers.formatEther(account.pendingRefund)} OG`)
        console.log(`Nonce: ${account.nonce.toString()}`)
        console.log(`Additional Info: ${account.additionalInfo}`)
        console.log(`Deliverables: ${account.deliverables?.length || 0}`)
      }

      console.log()
      return { exists, account: exists ? account : null }
    } catch (error) {
      console.log(`❌ Account status check failed: ${error.message}`)
      console.log()
      return { exists: false, account: null }
    }
  }

  async simulateAddAccount(userAddress, amount) {
    console.log('🧪 Simulating addAccount Transaction')
    console.log('=' .repeat(50))

    try {
      const servingContract = new ethers.Contract(this.config.servingAddress, SERVING_ABI, this.provider)
      const value = ethers.parseEther(amount.toString())

      // Estimate gas
      const gasEstimate = await servingContract.addAccount.estimateGas(
        userAddress,
        this.config.providerAddress,
        'INFT Platform User Test',
        { value }
      )

      console.log(`✅ Gas Estimate: ${gasEstimate.toString()}`)
      console.log(`💰 Value: ${amount} OG`)
      console.log(`📝 Additional Info: INFT Platform User Test`)
      
      // Get current gas price
      const feeData = await this.provider.getFeeData()
      const estimatedCost = gasEstimate * (feeData.gasPrice || 0n)
      console.log(`💸 Estimated TX Cost: ${ethers.formatEther(estimatedCost)} OG`)

      console.log()
      return true
    } catch (error) {
      console.log(`❌ Simulation failed: ${error.message}`)
      console.log()
      return false
    }
  }

  async simulateDepositFund(userAddress, amount) {
    console.log('🧪 Simulating depositFund Transaction')
    console.log('=' .repeat(50))

    try {
      const servingContract = new ethers.Contract(this.config.servingAddress, SERVING_ABI, this.provider)
      const value = ethers.parseEther(amount.toString())

      // Estimate gas
      const gasEstimate = await servingContract.depositFund.estimateGas(
        userAddress,
        this.config.providerAddress,
        0, // cancelRetrievingAmount
        { value }
      )

      console.log(`✅ Gas Estimate: ${gasEstimate.toString()}`)
      console.log(`💰 Value: ${amount} OG`)
      console.log(`🔄 Cancel Retrieving Amount: 0`)
      
      // Get current gas price
      const feeData = await this.provider.getFeeData()
      const estimatedCost = gasEstimate * (feeData.gasPrice || 0n)
      console.log(`💸 Estimated TX Cost: ${ethers.formatEther(estimatedCost)} OG`)

      console.log()
      return true
    } catch (error) {
      console.log(`❌ Simulation failed: ${error.message}`)
      console.log()
      return false
    }
  }

  async sendAddAccountTransaction(userAddress, amount) {
    if (!this.signer) {
      console.log('❌ Cannot send transaction: No private key provided')
      return false
    }

    console.log('📤 Sending addAccount Transaction')
    console.log('=' .repeat(50))

    try {
      const servingContract = new ethers.Contract(this.config.servingAddress, SERVING_ABI, this.signer)
      const value = ethers.parseEther(amount.toString())

      const tx = await servingContract.addAccount(
        userAddress,
        this.config.providerAddress,
        'INFT Platform User Test',
        { value }
      )

      console.log(`✅ Transaction sent: ${tx.hash}`)
      console.log(`🔗 Explorer: https://chainscan-galileo.0g.ai/tx/${tx.hash}`)
      console.log('⏳ Waiting for confirmation...')

      const receipt = await tx.wait()
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`)
      console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`)

      console.log()
      return true
    } catch (error) {
      console.log(`❌ Transaction failed: ${error.message}`)
      console.log()
      return false
    }
  }

  async run() {
    const args = process.argv.slice(2)
    const simulateOnly = args.includes('--simulate-only')
    const sendTx = args.includes('--send-tx')
    const amountIndex = args.indexOf('--amount')
    const amount = amountIndex >= 0 ? parseFloat(args[amountIndex + 1]) || 0.01 : 0.01

    console.log('🚀 Fine-tune Flow Diagnostic Tool')
    console.log('=' .repeat(50))
    console.log(`Mode: ${sendTx ? 'SEND TRANSACTIONS' : 'SIMULATION ONLY'}`)
    console.log(`Amount: ${amount} OG`)
    console.log()

    // Step 1: Environment validation
    const envValid = await this.printEnvironmentInfo()
    if (!envValid) {
      console.log('❌ Environment validation failed')
      process.exit(1)
    }

    // Step 2: Contract validation
    const contractsValid = await this.validateContracts()
    if (!contractsValid) {
      console.log('❌ Contract validation failed')
      process.exit(1)
    }

    // Step 3: Provider registration check
    const providerValid = await this.testProviderRegistration()
    if (!providerValid) {
      console.log('❌ Provider validation failed')
      process.exit(1)
    }

    // Step 4: Account status check
    const userAddress = this.signer?.address || '0x0000000000000000000000000000000000000000'
    const { exists, account } = await this.checkAccountStatus(userAddress)

    // Step 5: Transaction simulation
    if (!exists) {
      console.log('📋 Account does not exist - testing addAccount')
      const simulationOk = await this.simulateAddAccount(userAddress, amount)
      
      if (simulationOk && sendTx && !simulateOnly) {
        await this.sendAddAccountTransaction(userAddress, amount)
        // Re-check account status
        await this.checkAccountStatus(userAddress)
      }
    } else {
      console.log('📋 Account exists - testing depositFund')
      const simulationOk = await this.simulateDepositFund(userAddress, amount)
      
      if (simulationOk && sendTx && !simulateOnly) {
        console.log('💡 To send depositFund transaction, implement sendDepositFundTransaction method')
      }
    }

    console.log('✅ Diagnostic complete')
    
    // Exit with appropriate code
    process.exit(0)
  }
}

// Run the tester
const tester = new FineTuneFlowTester()
tester.run().catch(error => {
  console.error('💥 Unexpected error:', error)
  process.exit(1)
})