const { ethers } = require('./node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./node_modules/@0glabs/0g-serving-broker');

// Конфигурация
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testSDKDepositLogic() {
  console.log('🧪 Testing SDK Deposit Logic Fix');
  console.log('=================================');

  try {
    // 1. Setup
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const broker = await createZGComputeNetworkBroker(wallet);

    console.log(`✅ User address: ${wallet.address}`);

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
      console.log(`ℹ️  No existing ledger account found: ${error.message}`);
    }

    // 4. Test appropriate method based on account existence
    const depositAmount = '0.005'; // Very small test amount
    const depositAmountWei = ethers.parseEther(depositAmount);
    
    console.log(`\n📝 Testing deposit with amount: ${depositAmount} OG`);
    console.log(`   Amount in Wei: ${depositAmountWei.toString()}`);
    
    if (hasExistingAccount) {
      console.log(`\n🔄 Using depositFund for existing account...`);
      try {
        // Используем depositFund для существующего аккаунта
        const tx = await broker.ledger.depositFund(depositAmountWei);
        console.log(`✅ depositFund transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        console.log(`⏱️  Waiting for confirmation...`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check new balance
        const newAccount = await broker.ledger.getLedger();
        const newBalance = ethers.formatEther(newAccount.ledgerInfo[0]);
        console.log(`✅ New balance: ${newBalance} OG (was ${currentBalance} OG)`);
        
        const balanceIncrease = parseFloat(newBalance) - parseFloat(currentBalance);
        console.log(`✅ Balance increased by: ${balanceIncrease.toFixed(6)} OG`);
        
      } catch (error) {
        console.error(`❌ depositFund failed: ${error.message}`);
        
        // Попробуем понять, что это за ошибка
        if (error.message.includes('Ledger already exists')) {
          console.log(`ℹ️  This is the original error we're trying to fix!`);
          return false;
        }
        throw error;
      }
    } else {
      console.log(`\n🆕 Using addLedger for new account...`);
      try {
        const tx = await broker.ledger.addLedger(depositAmountWei);
        console.log(`✅ addLedger transaction sent: ${tx.hash}`);
        
        // Wait for confirmation
        console.log(`⏱️  Waiting for confirmation...`);
        const receipt = await tx.wait();
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check new balance
        const newAccount = await broker.ledger.getLedger();
        const newBalance = ethers.formatEther(newAccount.ledgerInfo[0]);
        console.log(`✅ New account balance: ${newBalance} OG`);
        
      } catch (error) {
        console.error(`❌ addLedger failed: ${error.message}`);
        throw error;
      }
    }

    console.log(`\n🎉 SDK deposit logic test completed successfully!`);
    return true;

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    if (error.stack) {
      console.error(`Stack trace: ${error.stack}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Starting SDK Deposit Logic Test');
  console.log('==================================\n');

  const result = await testSDKDepositLogic();
  
  console.log('\n📊 Test Result:');
  console.log('===============');
  console.log(`SDK Deposit Test: ${result ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (result) {
    console.log('\n🎉 Test passed! The SDK deposit logic is working correctly.');
    console.log('This means our fix for choosing between addLedger and depositFund works.');
  } else {
    console.log('\n❌ Test failed. The deposit logic still has issues.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSDKDepositLogic };