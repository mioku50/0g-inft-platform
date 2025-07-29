const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testDepositFixed() {
  console.log('🧪 Testing Fixed Deposit Logic');
  console.log('==============================\n');

  try {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    
    // 1. Create SDK broker
    console.log('1. Creating SDK broker...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ SDK broker created');
    console.log('User address:', wallet.address, '\n');

    // 2. Check current balance
    console.log('2. Checking current ledger balance...');
    let currentBalance = 0;
    let hasAccount = false;
    
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      hasAccount = true;
      
      // Handle both formats: ledgerInfo[0] and ledgerInfo.ledgerInfo[0]
      if (ledgerInfo.ledgerInfo) {
        currentBalance = parseFloat(ethers.formatEther(ledgerInfo.ledgerInfo[0]));
        console.log('✅ Ledger account exists');
        console.log('   Balance:', ethers.formatEther(ledgerInfo.ledgerInfo[0]), 'OG');
        console.log('   Locked:', ethers.formatEther(ledgerInfo.ledgerInfo[1]), 'OG');
      } else if (Array.isArray(ledgerInfo)) {
        currentBalance = parseFloat(ethers.formatEther(ledgerInfo[0]));
        console.log('✅ Ledger account exists (array format)');
        console.log('   Balance:', ethers.formatEther(ledgerInfo[0]), 'OG');
        console.log('   Locked:', ethers.formatEther(ledgerInfo[1]), 'OG');
      } else {
        console.log('⚠️  Unexpected ledger format:', ledgerInfo);
      }
    } catch (error) {
      console.log('❌ No ledger account found, will create one');
    }

    // 3. Test deposit
    console.log('\n3. Testing deposit...');
    const depositAmount = 0.005; // OG
    
    try {
      if (hasAccount) {
        console.log(`Calling depositFund(${depositAmount})...`);
        await broker.ledger.depositFund(depositAmount);
        console.log('✅ depositFund completed');
      } else {
        console.log(`Calling addLedger(${depositAmount})...`);
        await broker.ledger.addLedger(depositAmount);
        console.log('✅ addLedger completed');
      }
    } catch (error) {
      console.log('❌ Deposit failed:', error.message);
      return;
    }

    // 4. Verify new balance
    console.log('\n4. Verifying new balance...');
    try {
      const newLedgerInfo = await broker.ledger.getLedger();
      let newBalance = 0;
      
      if (newLedgerInfo.ledgerInfo) {
        newBalance = parseFloat(ethers.formatEther(newLedgerInfo.ledgerInfo[0]));
        console.log('✅ New balance:', ethers.formatEther(newLedgerInfo.ledgerInfo[0]), 'OG');
      } else if (Array.isArray(newLedgerInfo)) {
        newBalance = parseFloat(ethers.formatEther(newLedgerInfo[0]));
        console.log('✅ New balance:', ethers.formatEther(newLedgerInfo[0]), 'OG');
      }
      
      const increase = newBalance - currentBalance;
      console.log(`✅ Balance increased by: ${increase.toFixed(6)} OG`);
      
      if (Math.abs(increase - depositAmount) < 0.000001) {
        console.log('✅ Deposit amount matches expected!');
      } else {
        console.log('⚠️  Deposit amount mismatch. Expected:', depositAmount, 'Actual:', increase);
      }
    } catch (error) {
      console.log('❌ Failed to verify new balance:', error.message);
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testDepositFixed().catch(console.error);