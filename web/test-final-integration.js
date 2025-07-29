const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testFinalIntegration() {
  console.log('🧪 Final Integration Test');
  console.log('=========================');

  try {
    // 1. Setup provider and wallet
    console.log('\n1. Setting up provider and wallet...');
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const userAddress = wallet.address;
    
    console.log(`User address: ${userAddress}`);
    console.log(`Provider address: ${config.PROVIDER_ADDRESS}`);

    // 2. Test direct contract interaction
    console.log('\n2. Testing direct contract interaction...');
    const servingAbi = [
      'function accountExists(address user, address provider) view returns (bool)',
      'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
      'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
      'function addAccount(address user, address provider, string additionalInfo) payable'
    ];
    
    const servingContract = new ethers.Contract(config.SERVING_ADDRESS, servingAbi, wallet);

    // Check provider
    try {
      const service = await servingContract.getService(config.PROVIDER_ADDRESS);
      console.log('✅ Provider found:', {
        url: service.url,
        pricePerToken: service.pricePerToken.toString(),
        providerSigner: service.providerSigner,
        occupied: service.occupied
      });
    } catch (serviceError) {
      console.log('❌ Provider check failed:', serviceError.message);
      return;
    }

    // Check account
    try {
      const accountExists = await servingContract.accountExists(userAddress, config.PROVIDER_ADDRESS);
      console.log(`Account exists: ${accountExists}`);
      
      if (accountExists) {
        const account = await servingContract.getAccount(userAddress, config.PROVIDER_ADDRESS);
        console.log('Account details:', {
          balance: ethers.formatEther(account.balance),
          nonce: account.nonce.toString(),
          pendingRefund: ethers.formatEther(account.pendingRefund)
        });
      }
    } catch (accountError) {
      console.log('❌ Account check failed:', accountError.message);
    }

    // 3. Test SDK broker
    console.log('\n3. Testing SDK broker...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ SDK broker created');

    // Test ledger methods
    console.log('\nTesting ledger methods...');
    console.log('Available ledger methods:', Object.getOwnPropertyNames(broker.ledger).filter(name => typeof broker.ledger[name] === 'function'));

    // 4. Try different approaches
    console.log('\n4. Trying different approaches...');
    
    // Approach 1: Direct serving contract addAccount
    if (!await servingContract.accountExists(userAddress, config.PROVIDER_ADDRESS)) {
      console.log('Approach 1: Direct serving contract addAccount...');
      try {
        const amount = ethers.parseEther('0.01');
        const tx = await servingContract.addAccount(
          userAddress,
          config.PROVIDER_ADDRESS,
          'INFT Platform User',
          { value: amount }
        );
        
        console.log('✅ Direct addAccount transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Direct addAccount confirmed:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } catch (directError) {
        console.log('❌ Direct addAccount failed:', directError.message);
      }
    }

    // Approach 2: SDK ledger methods
    console.log('\nApproach 2: SDK ledger methods...');
    try {
      // Check what parameters addLedger actually expects
      console.log('Trying SDK addLedger with minimal parameters...');
      
      const result = await broker.ledger.addLedger(0.01);
      console.log('✅ SDK addLedger result:', result);
      
    } catch (sdkError) {
      console.log('❌ SDK addLedger failed:', sdkError.message);
      
      // Try depositFund if addLedger fails
      try {
        console.log('Trying SDK depositFund...');
        const depositResult = await broker.ledger.depositFund(0.01);
        console.log('✅ SDK depositFund result:', depositResult);
        
      } catch (depositError) {
        console.log('❌ SDK depositFund failed:', depositError.message);
      }
    }

    // 5. Check final account state
    console.log('\n5. Checking final account state...');
    try {
      const accountExists = await servingContract.accountExists(userAddress, config.PROVIDER_ADDRESS);
      console.log(`Final account exists: ${accountExists}`);
      
      if (accountExists) {
        const account = await servingContract.getAccount(userAddress, config.PROVIDER_ADDRESS);
        console.log('Final account details:', {
          balance: ethers.formatEther(account.balance),
          nonce: account.nonce.toString(),
          pendingRefund: ethers.formatEther(account.pendingRefund)
        });
      }
    } catch (finalError) {
      console.log('❌ Final account check failed:', finalError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFinalIntegration().catch(console.error);