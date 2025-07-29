#!/usr/bin/env node

/**
 * Simple Deposit Test
 * Tests deposit functionality when account already exists
 */

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

async function testDeposit(amount = '0.01', simulateOnly = false) {
  try {
    const baseUrl = 'http://localhost:3000'
    
    log(`Testing deposit of ${amount} OG (${simulateOnly ? 'simulation' : 'real transaction'})...`)
    
    const response = await fetch(`${baseUrl}/api/compute/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deposit',
        amount: amount,
        simulate: simulateOnly
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      logSuccess(`Deposit ${simulateOnly ? 'simulation' : 'transaction'} successful`)
      if (result.txHash) {
        log(`Transaction hash: ${result.txHash}`)
      }
      if (result.simulation) {
        log(`Gas estimate: ${result.simulation.gasEstimate}`)
      }
      return true
    } else {
      logError(`Deposit failed: ${result.error}`)
      return false
    }
    
  } catch (error) {
    logError(`Deposit test failed: ${error.message}`)
    return false
  }
}

async function testAccountStatus() {
  try {
    const baseUrl = 'http://localhost:3000'
    
    log('Checking account status...')
    
    const response = await fetch(`${baseUrl}/api/compute/account`, {
      method: 'GET'
    })
    
    const result = await response.json()
    
    if (result.result) {
      logSuccess('Account status retrieved successfully')
      log(`Account exists: ${result.result.exists}`)
      log(`Balance: ${result.result.balance} OG`)
      log(`Pending refund: ${result.result.pendingRefund} OG`)
      if (result.result.nonce) {
        log(`Nonce: ${result.result.nonce}`)
      }
      return true
    } else {
      logError(`Account status check failed: ${result.error}`)
      return false
    }
    
  } catch (error) {
    logError(`Account status test failed: ${error.message}`)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const simulateOnly = args.includes('--simulate-only')
  const amountArg = args.find(arg => arg.startsWith('--amount'))
  const amount = amountArg ? amountArg.split('=')[1] : '0.01'
  
  log(`${colors.bold}💰 Deposit Test${colors.reset}`)
  log(`Amount: ${amount} OG`)
  log(`Mode: ${simulateOnly ? 'Simulation Only' : 'Real Transaction'}`)
  log('=' .repeat(30))
  
  try {
    // Check account status first
    await testAccountStatus()
    
    // Test deposit
    const depositSuccess = await testDeposit(amount, simulateOnly)
    
    if (depositSuccess) {
      log('\n' + '=' .repeat(30))
      logSuccess('🎉 Deposit test completed successfully!')
      
      // Check account status after deposit
      log('\nAccount status after deposit:')
      await testAccountStatus()
    } else {
      logError('Deposit test failed')
      process.exit(1)
    }
    
  } catch (error) {
    logError(`Test failed: ${error.message}`)
    console.error(error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}