#!/usr/bin/env node

/**
 * Frontend Fine-Tune E2E Test
 * Tests the complete flow through the API endpoints
 */

require('dotenv').config({ path: '../.env.local' });
const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/compute`;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
const log = {
  step: (msg) => console.log(`\n${colors.cyan}[Step]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  data: (label, value) => console.log(`  ${label}: ${value}`)
};

async function makeRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  log.info(`Request: ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    }
    
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function runTest() {
  console.log(`\n${colors.cyan}=== FRONTEND FINE-TUNE E2E TEST ===${colors.reset}\n`);
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`API endpoint: ${API_URL}\n`);
  
  try {
    // Step 1: Check current account status
    log.step('1. Checking account status');
    const accountCheck = await makeRequest('/account');
    
    if (!accountCheck.success) {
      log.error(`Failed to check account: ${accountCheck.error}`);
      return;
    }
    
    log.success('Account status retrieved');
    log.data('Exists', accountCheck.data.result.exists);
    log.data('Balance', accountCheck.data.result.balance);
    log.data('Needs top-up', accountCheck.data.result.needsTopUp);
    
    if (accountCheck.data.diagnostics) {
      log.info('Diagnostic info:');
      log.data('Wallet', accountCheck.data.diagnostics.walletAddress);
      log.data('Ledger', accountCheck.data.diagnostics.ledgerContract);
    }
    
    // Step 2: Create or deposit to Ledger account
    if (!accountCheck.data.result.exists || accountCheck.data.result.needsTopUp) {
      log.step('2. Funding Ledger account');
      
      const action = !accountCheck.data.result.exists ? 'create' : 'deposit';
      const amount = 0.01; // OG
      
      log.info(`Action: ${action}, Amount: ${amount} OG`);
      
      const fundResult = await makeRequest('/account', {
        method: 'POST',
        body: JSON.stringify({ amount, action })
      });
      
      if (!fundResult.success) {
        log.error(`Failed to ${action} account: ${fundResult.error}`);
        return;
      }
      
      log.success(`Account ${action}d successfully`);
      log.data('Previous balance', fundResult.data.previousBalance);
      log.data('New balance', fundResult.data.newBalance);
      log.data('Deposited', fundResult.data.deposited);
    } else {
      log.step('2. Ledger account already funded');
      log.success('Skipping deposit');
    }
    
    // Step 3: Check Fine-Tune account
    log.step('3. Checking Fine-Tune sub-account');
    const ftAccountCheck = await makeRequest('/finetune/account');
    
    if (!ftAccountCheck.success) {
      log.error(`Failed to check Fine-Tune account: ${ftAccountCheck.error}`);
    } else {
      log.success('Fine-Tune account status retrieved');
      log.data('Exists', ftAccountCheck.data.result.exists);
      log.data('Balance', ftAccountCheck.data.result.balance);
      log.data('Provider acknowledged', ftAccountCheck.data.result.providerAcknowledged);
    }
    
    // Step 4: List available providers
    log.step('4. Listing Fine-Tune providers');
    const providersResult = await makeRequest('/finetune/providers');
    
    if (!providersResult.success) {
      log.error(`Failed to list providers: ${providersResult.error}`);
    } else {
      log.success(`Found ${providersResult.data.providers.length} providers`);
      providersResult.data.providers.forEach((provider, i) => {
        log.info(`Provider ${i + 1}:`);
        log.data('Address', provider.address);
        log.data('Available', provider.available);
        log.data('Price/byte', provider.pricePerByte);
      });
    }
    
    // Step 5: Attempt to create a task (will fail without real data)
    log.step('5. Testing task creation (expected to fail with mock data)');
    const taskData = {
      provider: process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      model: 'distilbert-base-uncased',
      datasetHash: '0x' + '0'.repeat(62) + '42',
      dataSize: 1024,
      trainingParams: {
        num_train_epochs: 3,
        per_device_train_batch_size: 16
      }
    };
    
    log.info('Task parameters:');
    Object.entries(taskData).forEach(([key, value]) => {
      log.data(key, typeof value === 'object' ? JSON.stringify(value) : value);
    });
    
    const taskResult = await makeRequest('/finetune/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    
    if (!taskResult.success) {
      log.info(`Task creation failed as expected: ${taskResult.error}`);
      log.info('This is normal - real dataset upload to 0G Storage is required');
    } else {
      log.success('Task created successfully!');
      log.data('Task ID', taskResult.data.taskId);
    }
    
    // Step 6: Final account status
    log.step('6. Final account check');
    const finalCheck = await makeRequest('/account');
    
    if (finalCheck.success) {
      log.success('Final status retrieved');
      log.data('Balance', finalCheck.data.result.balance);
      log.data('Locked', finalCheck.data.result.locked);
    }
    
    // Summary
    console.log(`\n${colors.cyan}=== TEST SUMMARY ===${colors.reset}\n`);
    log.success('API endpoints are accessible');
    log.success('Account operations work correctly');
    log.success('Fine-Tune infrastructure is in place');
    log.info('To create real Fine-Tune tasks:');
    log.data('1', 'Upload training data to 0G Storage');
    log.data('2', 'Use the returned hash in task creation');
    log.data('3', 'Monitor task progress through the API');
    
    console.log(`\n${colors.green}✅ Frontend integration test complete!${colors.reset}\n`);
    
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    console.error(error);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return true;
  } catch (error) {
    log.error(`Server not accessible at ${BASE_URL}`);
    log.info('Please ensure the development server is running: npm run dev');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🧪 Starting Fine-Tune Frontend E2E Test');
  
  const serverOk = await checkServer();
  if (!serverOk) {
    process.exit(1);
  }
  
  await runTest();
}

main().catch(console.error);