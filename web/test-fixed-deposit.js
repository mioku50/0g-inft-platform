const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testFixedDeposit() {
  console.log('🧪 Testing Fixed Deposit Functionality');
  console.log('======================================');

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

    // 3. Check current account status
    console.log('\n3. Checking current account status...');
    try {
      const account = await broker.fineTuning.getAccount(userAddress, config.PROVIDER_ADDRESS);
      console.log('✅ Account exists:', {
        balance: ethers.formatEther(account.balance),
        nonce: account.nonce.toString(),
        pendingRefund: ethers.formatEther(account.pendingRefund)
      });
      
      // Test deposit to existing account
      console.log('\n4. Testing deposit to existing account...');
      const depositAmount = 0.01; // SDK expects number, not string
      
      const depositTx = await broker.ledger.depositFund(
        userAddress,
        config.PROVIDER_ADDRESS,
        depositAmount,
        0 // cancelRetrievingAmount
      );
      
      console.log('✅ Deposit transaction sent:', depositTx.hash);
      
      const depositReceipt = await depositTx.wait();
      console.log('✅ Deposit confirmed:', depositReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
      // Check updated balance
      console.log('\n5. Checking updated balance...');
      const updatedAccount = await broker.fineTuning.getAccount(userAddress, config.PROVIDER_ADDRESS);
      console.log('✅ Updated account:', {
        balance: ethers.formatEther(updatedAccount.balance),
        nonce: updatedAccount.nonce.toString(),
        pendingRefund: ethers.formatEther(updatedAccount.pendingRefund)
      });
      
    } catch (accountError) {
      if (accountError.message.includes('AccountNotExists')) {
        console.log('❌ Account does not exist, need to create it first');
        
        // Test account creation with deposit
        console.log('\n4. Testing account creation with deposit...');
        const createAmount = 0.01; // SDK expects number, not string
        
        const createTx = await broker.ledger.addLedger(
          userAddress,
          config.PROVIDER_ADDRESS,
          createAmount,
          'INFT Platform User'
        );
        
        console.log('✅ Account creation transaction sent:', createTx.hash);
        
        const createReceipt = await createTx.wait();
        console.log('✅ Account creation confirmed:', createReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
        // Check new account
        console.log('\n5. Checking new account...');
        const newAccount = await broker.fineTuning.getAccount(userAddress, config.PROVIDER_ADDRESS);
        console.log('✅ New account:', {
          balance: ethers.formatEther(newAccount.balance),
          nonce: newAccount.nonce.toString(),
          pendingRefund: ethers.formatEther(newAccount.pendingRefund)
        });
        
      } else {
        throw accountError;
      }
    }

    // 6. Test the web API endpoint
    console.log('\n6. Testing web API endpoint...');
    try {
      const response = await fetch('http://localhost:3000/api/compute/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deposit',
          amount: '0.01'
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ API endpoint works:', result);
      } else {
        const error = await response.text();
        console.log('❌ API endpoint failed:', error);
      }
    } catch (apiError) {
      console.log('❌ API test failed (server not running?):', apiError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFixedDeposit().catch(console.error);