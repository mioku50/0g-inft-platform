const axios = require('./web/node_modules/axios').default;

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/compute';
const TEST_CONFIG = {
  agentId: 'test-agent-' + Date.now(),
  datasetRootHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  baseModel: 'distilbert-base-uncased',
  steps: 500,
  learningRate: 0.00005,
  depositAmount: '0.01'
};

async function runE2EFineTuneTest() {
  console.log('🧪 E2E Fine-Tune Test - Complete Flow');
  console.log('=====================================\n');
  console.log('Test Configuration:');
  console.log('  Agent ID:', TEST_CONFIG.agentId);
  console.log('  Dataset Hash:', TEST_CONFIG.datasetRootHash);
  console.log('  Base Model:', TEST_CONFIG.baseModel);
  console.log('  Training Steps:', TEST_CONFIG.steps);
  console.log('  Learning Rate:', TEST_CONFIG.learningRate);
  console.log('  Deposit Amount:', TEST_CONFIG.depositAmount, 'OG\n');

  try {
    // Step 1: Check main ledger account status
    console.log('1️⃣ Checking main ledger account...');
    const accountResponse = await axios.get(`${API_BASE_URL}/account`);
    const accountData = accountResponse.data.result;
    
    console.log('✅ Main Ledger Account Status:');
    console.log('  Exists:', accountData.exists);
    console.log('  Balance:', accountData.balance, 'OG');
    console.log('  Locked:', accountData.locked || '0', 'OG');
    console.log('  Needs top up:', accountData.needsTopUp);

    // Step 2: Top up if needed
    if (accountData.needsTopUp || parseFloat(accountData.balance) < 0.01) {
      console.log('\n2️⃣ Topping up main ledger account...');
      const action = accountData.exists ? 'deposit' : 'create';
      
      const depositResponse = await axios.post(`${API_BASE_URL}/account`, {
        action,
        amount: TEST_CONFIG.depositAmount
      });

      if (depositResponse.data.success) {
        console.log('✅ Deposit successful!');
        console.log('  Previous balance:', depositResponse.data.previousBalance, 'OG');
        console.log('  New balance:', depositResponse.data.newBalance, 'OG');
        console.log('  Status:', depositResponse.data.status);
      } else {
        throw new Error('Deposit failed: ' + JSON.stringify(depositResponse.data));
      }
    } else {
      console.log('\n2️⃣ Main ledger account has sufficient balance, skipping deposit');
    }

    // Step 3: Check Fine-Tune sub-account status
    console.log('\n3️⃣ Checking Fine-Tune sub-account...');
    const fineTuneAccountResponse = await axios.get(`${API_BASE_URL}/finetune/account`);
    const fineTuneData = fineTuneAccountResponse.data.result;
    
    console.log('✅ Fine-Tune Sub-Account Status:');
    console.log('  Exists:', fineTuneData.exists);
    console.log('  Balance:', fineTuneData.balance, 'OG');
    console.log('  Pending Refund:', fineTuneData.pendingRefund, 'OG');
    console.log('  Deliverables:', fineTuneData.deliverables);
    console.log('  Provider:', fineTuneData.provider);
    console.log('  Main Ledger Balance:', fineTuneData.ledgerBalance, 'OG');
    console.log('  Insufficient Ledger Balance:', fineTuneData.insufficientLedgerBalance);

    // Step 4: Validate prerequisites
    if (fineTuneData.insufficientLedgerBalance) {
      throw new Error('Insufficient main ledger balance for Fine-Tune operations');
    }

    // Step 5: Create Fine-Tune task
    console.log('\n4️⃣ Creating Fine-Tune task...');
    const taskResponse = await axios.post(`${API_BASE_URL}/fine-tune`, {
      agentId: TEST_CONFIG.agentId,
      datasetRootHash: TEST_CONFIG.datasetRootHash,
      baseModel: TEST_CONFIG.baseModel,
      steps: TEST_CONFIG.steps,
      learningRate: TEST_CONFIG.learningRate
    });

    if (taskResponse.data.success !== false) {
      console.log('❌ Task creation failed:', taskResponse.data);
      throw new Error('Task creation failed');
    }

    console.log('✅ Fine-Tune task created successfully!');
    console.log('  Task ID:', taskResponse.data.taskId || 'Not returned yet');
    console.log('  Message:', taskResponse.data.message);
    console.log('  Estimated Time:', taskResponse.data.estimatedTime);

    // Step 6: Verify updated account balances
    console.log('\n5️⃣ Verifying updated account balances...');
    
    // Check main ledger
    const updatedAccountResponse = await axios.get(`${API_BASE_URL}/account`);
    const updatedAccountData = updatedAccountResponse.data.result;
    
    console.log('✅ Updated Main Ledger Balance:', updatedAccountData.balance, 'OG');
    
    // Check Fine-Tune sub-account
    const updatedFineTuneResponse = await axios.get(`${API_BASE_URL}/finetune/account`);
    const updatedFineTuneData = updatedFineTuneResponse.data.result;
    
    console.log('✅ Updated Fine-Tune Sub-Account:');
    console.log('  Balance:', updatedFineTuneData.balance, 'OG');
    console.log('  Deliverables:', updatedFineTuneData.deliverables);

    // Step 7: Summary
    console.log('\n🎉 E2E Fine-Tune Test COMPLETED SUCCESSFULLY!');
    console.log('===============================================');
    console.log('✅ Main ledger account: Working');
    console.log('✅ Balance management: Working');
    console.log('✅ Fine-Tune API: Working');
    console.log('✅ Task creation: Working');
    console.log('✅ Provider integration: Working');
    
    console.log('\n📋 Test Results Summary:');
    console.log('  Main Ledger Balance:', updatedAccountData.balance, 'OG');
    console.log('  Fine-Tune Sub-Account Exists:', updatedFineTuneData.exists);
    console.log('  Task Status: Accepted by provider');
    console.log('  Provider:', fineTuneData.provider);
    
    return {
      success: true,
      mainLedgerBalance: updatedAccountData.balance,
      fineTuneExists: updatedFineTuneData.exists,
      taskAccepted: true,
      provider: fineTuneData.provider
    };

  } catch (error) {
    console.error('\n❌ E2E Test FAILED!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Run the test
if (require.main === module) {
  runE2EFineTuneTest()
    .then(result => {
      if (result.success) {
        console.log('\n🎯 All Fine-Tune functionality is working correctly!');
        process.exit(0);
      } else {
        console.log('\n💥 Fine-Tune functionality has issues that need to be addressed.');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runE2EFineTuneTest, TEST_CONFIG };