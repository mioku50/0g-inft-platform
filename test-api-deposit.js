const { ethers } = require('./web/node_modules/ethers');

// Конфигурация  
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65',
  API_BASE_URL: 'http://localhost:3000'
};

async function testApiDeposit() {
  console.log('🧪 Testing API Deposit Logic');
  console.log('===============================\n');

  try {
    // 1. Проверка начального состояния
    console.log('1️⃣ Checking initial account state...');
    const checkResponse = await fetch(`${config.API_BASE_URL}/api/compute/account`);
    const checkData = await checkResponse.json();
    
    if (!checkResponse.ok) {
      console.error('❌ Failed to check account:', checkData);
      return;
    }

    const accountInfo = checkData.result;
    console.log('📊 Account info:');
    console.log('   Exists:', accountInfo.exists);
    console.log('   Balance:', accountInfo.balance, 'OG');
    console.log('   Locked:', accountInfo.locked || '0', 'OG');
    console.log('   Needs top-up:', accountInfo.needsTopUp, '\n');

    // 2. Определение действия
    const action = accountInfo.exists ? 'deposit' : 'create';
    const amount = '0.005'; // OG
    
    console.log(`2️⃣ Performing ${action} with amount: ${amount} OG`);
    
    // 3. Выполнение депозита
    const depositResponse = await fetch(`${config.API_BASE_URL}/api/compute/account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, action })
    });

    const depositData = await depositResponse.json();
    
    if (!depositResponse.ok) {
      console.error('❌ Deposit failed:', depositData);
      console.error('   Status:', depositResponse.status);
      console.error('   Error:', depositData.error);
      console.error('   Details:', depositData.details);
      return;
    }

    console.log('✅ Deposit successful!');
    console.log('   Previous balance:', depositData.previousBalance, 'OG');
    console.log('   New balance:', depositData.newBalance, 'OG');
    console.log('   Deposited:', depositData.deposited, 'OG');
    console.log('   Status:', depositData.status, '\n');

    // 4. Проверка обновленного баланса
    console.log('3️⃣ Verifying updated balance...');
    const verifyResponse = await fetch(`${config.API_BASE_URL}/api/compute/account`);
    const verifyData = await verifyResponse.json();
    
    if (verifyResponse.ok && verifyData.result) {
      const newInfo = verifyData.result;
      console.log('✅ Updated account info:');
      console.log('   Exists:', newInfo.exists);
      console.log('   Balance:', newInfo.balance, 'OG');
      console.log('   Locked:', newInfo.locked || '0', 'OG');
      console.log('   Needs top-up:', newInfo.needsTopUp);
      
      // Проверка что баланс увеличился
      const balanceIncreased = parseFloat(newInfo.balance) > parseFloat(accountInfo.balance);
      console.log(`\n✅ Balance ${balanceIncreased ? 'increased' : 'did not increase'} as expected`);
    }

    console.log('\n🎉 API deposit test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Запуск теста
console.log('⚠️  Make sure the Next.js dev server is running on port 3000!');
console.log('   Run: cd web && npm run dev\n');

setTimeout(() => {
  testApiDeposit();
}, 2000);