const axios = require('./web/node_modules/axios').default;

async function testAPIDeposit() {
  console.log('🧪 Testing API Deposit (Fixed)');
  console.log('==============================\n');

  const API_BASE_URL = 'http://localhost:3000/api/compute/account';

  try {
    // 1. Check current account status
    console.log('1. Checking account status...');
    const getResponse = await axios.get(API_BASE_URL);
    const accountData = getResponse.data.result;
    
    console.log('Account status:');
    console.log('  Exists:', accountData.exists);
    console.log('  Balance:', accountData.balance, 'OG');
    console.log('  Locked:', accountData.locked || '0', 'OG');
    console.log('  Needs top up:', accountData.needsTopUp);

    // 2. Determine action based on account status
    const action = accountData.exists ? 'deposit' : 'create';
    const amount = '0.01'; // OG

    console.log(`\n2. Performing ${action} with amount: ${amount} OG...`);
    
    const postResponse = await axios.post(API_BASE_URL, {
      action,
      amount
    });

    if (postResponse.data.success) {
      console.log('✅ Transaction successful!');
      console.log('  Previous balance:', postResponse.data.previousBalance, 'OG');
      console.log('  New balance:', postResponse.data.newBalance, 'OG');
      console.log('  Deposited:', postResponse.data.deposited, 'OG');
      console.log('  Status:', postResponse.data.status);
    } else {
      console.log('❌ Transaction failed:', postResponse.data);
    }

    // 3. Verify new balance
    console.log('\n3. Verifying new balance...');
    const verifyResponse = await axios.get(API_BASE_URL);
    const newAccountData = verifyResponse.data.result;
    console.log('✅ Updated balance:', newAccountData.balance, 'OG');

  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from server. Is the Next.js dev server running?');
      console.error('   Run: cd web && pnpm dev');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

// Run the test
testAPIDeposit().catch(console.error);