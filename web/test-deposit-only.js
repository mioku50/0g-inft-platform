const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testDepositOnly() {
  console.log('🧪 Testing Deposit Only');
  console.log('========================');

  try {
    // 1. Setup provider and wallet
    console.log('\n1. Setting up provider and wallet...');
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const userAddress = wallet.address;
    
    console.log(`User address: ${userAddress}`);
    console.log(`Provider address: ${config.PROVIDER_ADDRESS}`);

    // 2. Create SDK broker instance
    console.log('\n2. Creating SDK broker instance...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ SDK broker created successfully');

    // 3. Test deposit directly
    console.log('\n3. Testing deposit...');
    const depositAmount = 0.01; // SDK expects number, not string
    
    try {
      const depositTx = await broker.ledger.depositFund(
        userAddress,
        config.PROVIDER_ADDRESS,
        depositAmount,
        0 // cancelRetrievingAmount
      );
      
      console.log('✅ Deposit transaction sent:', depositTx.hash);
      console.log('🔗 Transaction URL: https://chainscan-galileo.0g.ai/tx/' + depositTx.hash);
      
      const depositReceipt = await depositTx.wait();
      console.log('✅ Deposit confirmed:', depositReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
      // 4. Check if account now exists in FineTuning
      console.log('\n4. Checking FineTuning account after deposit...');
      try {
        const account = await broker.fineTuning.getAccount(userAddress, config.PROVIDER_ADDRESS);
        console.log('✅ FineTuning account now exists:', {
          balance: ethers.formatEther(account.balance),
          nonce: account.nonce.toString(),
          pendingRefund: ethers.formatEther(account.pendingRefund)
        });
      } catch (accountError) {
        console.log('❌ FineTuning account still does not exist:', accountError.message);
      }
      
    } catch (depositError) {
      console.log('❌ Deposit failed:', depositError.message);
      
      // Try to understand the error better
      if (depositError.message.includes('AccountNotExists')) {
        console.log('💡 The account needs to be created in FineTuning system first');
        console.log('💡 This suggests Ledger and FineTuning have separate account systems');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDepositOnly().catch(console.error);