const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65',
  LEDGER_CONTRACT: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa'
};

async function testDepositIssue() {
  console.log('🧪 Testing Deposit Method Conflict');
  console.log('===================================\n');

  try {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    
    // 1. Create SDK broker
    console.log('1. Creating SDK broker...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ SDK broker created\n');

    // 2. Check original SDK method
    console.log('2. Checking original SDK depositFund method...');
    console.log('SDK depositFund type:', typeof broker.ledger.depositFund);
    console.log('SDK depositFund toString:', broker.ledger.depositFund.toString().substring(0, 100) + '...\n');

    // 3. Create contract instance (как в broker.ts)
    console.log('3. Creating contract instance...');
    const LEDGER_ABI = [
      'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable'
    ];
    const ledgerContract = new ethers.Contract(config.LEDGER_CONTRACT, LEDGER_ABI, wallet);
    console.log('Contract depositFund type:', typeof ledgerContract.depositFund);
    console.log('Contract depositFund toString:', ledgerContract.depositFund.toString().substring(0, 100) + '...\n');

    // 4. Simulate what happens in broker.ts
    console.log('4. Simulating broker.ts override...');
    const originalDepositFund = broker.ledger.depositFund;
    broker.ledger.depositFund = ledgerContract.depositFund.bind(ledgerContract);
    console.log('After override, depositFund type:', typeof broker.ledger.depositFund);
    console.log('After override, depositFund toString:', broker.ledger.depositFund.toString().substring(0, 100) + '...\n');

    // 5. Try to call with SDK style (will fail)
    console.log('5. Testing depositFund calls...');
    try {
      console.log('Trying SDK style call: depositFund(0.01)...');
      await broker.ledger.depositFund(0.01);
      console.log('✅ SDK style call succeeded');
    } catch (error) {
      console.log('❌ SDK style call failed:', error.message);
    }

    // 6. Try with contract style (what the error suggests)
    try {
      console.log('\nTrying contract style call: depositFund(user, provider, 0, {value})...');
      const tx = await broker.ledger.depositFund(
        wallet.address,
        config.PROVIDER_ADDRESS,
        0,
        { value: ethers.parseEther('0.01') }
      );
      console.log('✅ Contract style call succeeded, tx:', tx.hash);
    } catch (error) {
      console.log('❌ Contract style call failed:', error.message);
    }

    // 7. Restore original and test
    console.log('\n6. Testing with original SDK method...');
    broker.ledger.depositFund = originalDepositFund;
    
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      const balanceBefore = ethers.formatEther(ledgerInfo[0]);
      console.log('Current balance:', balanceBefore, 'OG');
      
      console.log('Calling original SDK depositFund(0.005)...');
      await broker.ledger.depositFund(0.005);
      
      const ledgerInfoAfter = await broker.ledger.getLedger();
      const balanceAfter = ethers.formatEther(ledgerInfoAfter[0]);
      console.log('New balance:', balanceAfter, 'OG');
      console.log('✅ Original SDK method works correctly!');
    } catch (error) {
      console.log('❌ Original SDK method failed:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDepositIssue().catch(console.error);