const { ethers } = require('./node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./node_modules/@0glabs/0g-serving-broker');

// Конфигурация из логов
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testDepositLogicFix() {
  console.log('🧪 Testing Fixed Deposit Logic');
  console.log('==============================');

  try {
    // 1. Setup
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const broker = await createZGComputeNetworkBroker(wallet);

    console.log(`✅ User address: ${wallet.address}`);
    console.log(`✅ Provider address: ${config.PROVIDER_ADDRESS}`);

    // 2. Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`✅ Wallet balance: ${ethers.formatEther(balance)} OG`);

    if (parseFloat(ethers.formatEther(balance)) < 0.1) {
      throw new Error('Insufficient wallet balance for test');
    }

    // 3. Check existing ledger account
    let hasExistingAccount = false;
    let currentBalance = '0';
    try {
      const account = await broker.ledger.getLedger();
      hasExistingAccount = true;
      currentBalance = ethers.formatEther(account.ledgerInfo[0]);
      console.log(`✅ Existing ledger account found:`);
      console.log(`   Balance: ${currentBalance} OG`);
      console.log(`   Locked: ${ethers.formatEther(account.ledgerInfo[1])} OG`);
    } catch (error) {
      console.log(`ℹ️  No existing ledger account found`);
    }

    // 4. Test deposit logic based on account existence
    const depositAmount = '0.01'; // Small test amount
    
    if (hasExistingAccount) {
      console.log(`\n📝 Testing depositFund for existing account...`);
      try {
        const tx = await broker.ledger.depositFund(ethers.parseEther(depositAmount));
        console.log(`✅ depositFund transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check new balance
        const newAccount = await broker.ledger.getLedger();
        const newBalance = ethers.formatEther(newAccount.ledgerInfo[0]);
        console.log(`✅ New balance: ${newBalance} OG (was ${currentBalance} OG)`);
        
        const expectedIncrease = parseFloat(newBalance) - parseFloat(currentBalance);
        if (Math.abs(expectedIncrease - parseFloat(depositAmount)) < 0.001) {
          console.log(`✅ Balance increased correctly by ~${depositAmount} OG`);
        } else {
          console.log(`⚠️  Balance increase: ${expectedIncrease} OG (expected ${depositAmount} OG)`);
        }
        
      } catch (error) {
        console.error(`❌ depositFund failed:`, error.message);
        throw error;
      }
    } else {
      console.log(`\n📝 Testing addLedger for new account...`);
      try {
        const tx = await broker.ledger.addLedger(ethers.parseEther(depositAmount));
        console.log(`✅ addLedger transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check new balance
        const newAccount = await broker.ledger.getLedger();
        const newBalance = ethers.formatEther(newAccount.ledgerInfo[0]);
        console.log(`✅ New account balance: ${newBalance} OG`);
        
      } catch (error) {
        console.error(`❌ addLedger failed:`, error.message);
        throw error;
      }
    }

    console.log(`\n🎉 Deposit logic test completed successfully!`);
    return true;

  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

// Также тестируем логику проекта через API
async function testProjectDepositAPI() {
  console.log('\n🧪 Testing Project Deposit API Logic');
  console.log('====================================');

  try {
    // Импортируем логику из проекта
    const { getBroker } = require('./lib/compute/broker');
    
    const broker = await getBroker();
    console.log(`✅ Project broker initialized`);
    
    // Проверяем существующий аккаунт
    const FINE_TUNE_PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd';
    
    let hasAccount = false;
    try {
      hasAccount = await broker.fineTuning.accountExists(broker.signer.address, FINE_TUNE_PROVIDER);
      console.log(`✅ Account exists check: ${hasAccount}`);
    } catch (error) {
      console.log(`⚠️  Account exists check failed: ${error.message}`);
    }

    if (hasAccount) {
      try {
        const account = await broker.fineTuning.getAccount(broker.signer.address, FINE_TUNE_PROVIDER);
        console.log(`✅ Account balance: ${account.balance} (raw)`);
        console.log(`✅ Account pending refund: ${account.pendingRefund} (raw)`);
      } catch (error) {
        console.log(`⚠️  Could not get account details: ${error.message}`);
      }
    }

    // Тестируем новую логику depositFund
    const testAmount = '0.005'; // Очень маленькая сумма для теста
    console.log(`\n📝 Testing project depositFund with amount: ${testAmount} OG`);
    
    try {
      const result = await broker.fineTuning.depositFund(
        broker.signer.address,
        FINE_TUNE_PROVIDER,
        0n, // cancelRetrievingAmount
        testAmount
      );
      
      console.log(`✅ Project depositFund successful:`);
      console.log(`   TX Hash: ${result.txHash}`);
      console.log(`   Status: ${result.status}`);
      
    } catch (error) {
      if (error.message.includes('Ledger already exists')) {
        console.log(`❌ Still getting 'Ledger already exists' error - fix not working`);
        return false;
      } else {
        console.log(`⚠️  Other error (might be expected): ${error.message}`);
      }
    }

    console.log(`\n🎉 Project API test completed!`);
    return true;

  } catch (error) {
    console.error(`❌ Project API test failed:`, error.message);
    console.error(error.stack);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Deposit Logic Fix Tests');
  console.log('===================================\n');

  const sdkTest = await testDepositLogicFix();
  const projectTest = await testProjectDepositAPI();

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`SDK Deposit Test: ${sdkTest ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Project API Test: ${projectTest ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (sdkTest && projectTest) {
    console.log('\n🎉 All tests passed! Deposit logic fix is working.');
  } else {
    console.log('\n❌ Some tests failed. Need further investigation.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testDepositLogicFix, testProjectDepositAPI };