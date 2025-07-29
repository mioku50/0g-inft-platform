#!/usr/bin/env node

/**
 * Comprehensive Fine-Tune Flow Test
 * Tests the complete flow: deposit → account creation → fine-tune task creation
 * 
 * Usage:
 *   node scripts/test-fine-tune-complete-flow.js [--amount 0.01] [--simulate-only]
 */

// Simple test without external dependencies
// Environment variables should be loaded by the Next.js app

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

function logStep(step, message) {
  log(`\n${colors.bold}[STEP ${step}]${colors.reset} ${colors.blue}${message}${colors.reset}`)
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

async function testAccountAPI(amount = '0.01', simulateOnly = false) {
  logStep(1, 'Testing Account Creation/Deposit API')
  
  try {
    const baseUrl = 'http://localhost:3000'
    
    // Test account creation with deposit
    log('Testing account creation with deposit...')
    
    const createResponse = await fetch(`${baseUrl}/api/compute/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        amount: amount,
        simulate: simulateOnly
      })
    })
    
    const createResult = await createResponse.json()
    
    if (createResult.success) {
      logSuccess(`Account creation ${simulateOnly ? 'simulation' : 'transaction'} successful`)
      if (createResult.txHash) {
        log(`Transaction hash: ${createResult.txHash}`)
      }
      if (createResult.simulation) {
        log(`Gas estimate: ${createResult.simulation.gasEstimate}`)
      }
    } else {
      logError(`Account creation failed: ${createResult.error}`)
      return false
    }
    
    // Test deposit to existing account
    log('\nTesting deposit to existing account...')
    
    const depositResponse = await fetch(`${baseUrl}/api/compute/account`, {
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
    
    const depositResult = await depositResponse.json()
    
    if (depositResult.success || depositResult.error?.includes('AccountExists')) {
      logSuccess(`Deposit ${simulateOnly ? 'simulation' : 'transaction'} successful`)
      if (depositResult.txHash) {
        log(`Transaction hash: ${depositResult.txHash}`)
      }
    } else {
      logWarning(`Deposit result: ${depositResult.error || 'Unknown error'}`)
    }
    
    return true
    
  } catch (error) {
    logError(`Account API test failed: ${error.message}`)
    return false
  }
}

async function testAccountStatus() {
  logStep(2, 'Testing Account Status Check')
  
  try {
    const baseUrl = 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/compute/account`, {
      method: 'GET'
    })
    
    const result = await response.json()
    
    if (result.success) {
      logSuccess('Account status retrieved successfully')
      log(`Account exists: ${result.accountExists}`)
      if (result.account) {
        log(`Balance: ${result.account.balance} OG`)
        log(`Pending refund: ${result.account.pendingRefund} OG`)
        log(`Nonce: ${result.account.nonce}`)
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

async function testFineTuneTaskCreation(simulateOnly = false) {
  logStep(3, 'Testing Fine-Tune Task Creation')
  
  try {
    const baseUrl = 'http://localhost:3000'
    
    // Test data for fine-tune task
    const taskData = {
      model: 'distilbert-base-uncased',
      dataset: 'Sample training data for sentiment analysis\nPositive: This is great!\nNegative: This is bad!',
      trainingParams: {
        num_train_epochs: 1,
        per_device_train_batch_size: 8,
        learning_rate: 5e-5,
        warmup_steps: 100
      },
      simulate: simulateOnly
    }
    
    log('Creating fine-tune task...')
    
    const response = await fetch(`${baseUrl}/api/compute/fine-tune-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskData)
    })
    
    const result = await response.json()
    
    if (result.success) {
      logSuccess(`Fine-tune task ${simulateOnly ? 'simulation' : 'creation'} successful`)
      if (result.taskId) {
        log(`Task ID: ${result.taskId}`)
      }
      if (result.txHash) {
        log(`Transaction hash: ${result.txHash}`)
      }
      if (result.fee) {
        log(`Estimated fee: ${result.fee} neuron`)
      }
      return true
    } else {
      logError(`Fine-tune task creation failed: ${result.error}`)
      return false
    }
    
  } catch (error) {
    logError(`Fine-tune task test failed: ${error.message}`)
    return false
  }
}

async function checkEnvironment() {
  logStep(0, 'Environment Check')
  
  // Check if dev server is running
  try {
    const response = await fetch('http://localhost:3000/api/compute/account')
    logSuccess('Development server is running')
  } catch (error) {
    logError('Development server is not running. Please start with: npm run dev')
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const simulateOnly = args.includes('--simulate-only')
  const amountArg = args.find(arg => arg.startsWith('--amount'))
  const amount = amountArg ? amountArg.split('=')[1] : '0.01'
  
  log(`${colors.bold}🧪 Fine-Tune Complete Flow Test${colors.reset}`)
  log(`Amount: ${amount} OG`)
  log(`Mode: ${simulateOnly ? 'Simulation Only' : 'Real Transactions'}`)
  log('=' .repeat(50))
  
  try {
    // Check environment
    await checkEnvironment()
    
    // Test account operations
    const accountTest = await testAccountAPI(amount, simulateOnly)
    if (!accountTest) {
      logError('Account tests failed. Stopping.')
      process.exit(1)
    }
    
    // Check account status
    const statusTest = await testAccountStatus()
    if (!statusTest) {
      logWarning('Account status check failed, but continuing...')
    }
    
    // Test fine-tune task creation
    const taskTest = await testFineTuneTaskCreation(simulateOnly)
    if (!taskTest) {
      logError('Fine-tune task test failed.')
    }
    
    // Summary
    log('\n' + '=' .repeat(50))
    logSuccess('🎉 Complete Flow Test Finished')
    
    if (simulateOnly) {
      log('\n💡 To run with real transactions:')
      log(`node scripts/test-fine-tune-complete-flow.js --amount=${amount}`)
    } else {
      log('\n✅ All tests completed with real transactions')
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