const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testSDKIntegration() {
  console.log('🧪 Testing SDK Broker Integration');
  console.log('==================================');

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
    
    // Check available methods
    console.log('\nAvailable broker methods:');
    if (broker.fineTuning) {
      console.log('- fineTuning module available');
      console.log('  Methods:', Object.getOwnPropertyNames(broker.fineTuning).filter(name => typeof broker.fineTuning[name] === 'function'));
    } else {
      console.log('❌ fineTuning module not available');
    }

    // 3. Test account creation with SDK
    console.log('\n3. Testing account creation with SDK...');
    const amount = ethers.parseEther('0.01');
    
    try {
      // Use SDK to add account
      const tx = await broker.fineTuning.addAccount(
        userAddress,
        config.PROVIDER_ADDRESS,
        'INFT Platform User',
        { value: amount }
      );
      
      console.log('✅ Account creation transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
    } catch (sdkError) {
      console.log('❌ SDK account creation failed:', sdkError.message);
      
      // Try deposit instead
      console.log('\n4. Testing deposit with SDK...');
      try {
        const depositTx = await broker.fineTuning.depositFund(
          userAddress,
          config.PROVIDER_ADDRESS,
          0,
          { value: amount }
        );
        
        console.log('✅ Deposit transaction sent:', depositTx.hash);
        
        const depositReceipt = await depositTx.wait();
        console.log('✅ Deposit confirmed:', depositReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } catch (depositError) {
        console.log('❌ SDK deposit failed:', depositError.message);
      }
    }

    // 5. Test direct serving contract calls
    console.log('\n5. Testing direct serving contract calls...');
    const servingAbi = [
      'function addAccount(address user, address provider, string additionalInfo) payable',
      'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable',
      'function accountExists(address user, address provider) view returns (bool)',
      'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))'
    ];
    
    const servingContract = new ethers.Contract(config.SERVING_ADDRESS, servingAbi, wallet);
    
    // Check if account exists
    const accountExists = await servingContract.accountExists(userAddress, config.PROVIDER_ADDRESS);
    console.log(`Account exists: ${accountExists}`);
    
    if (accountExists) {
      // Try direct deposit to serving contract
      console.log('Testing direct deposit to serving contract...');
      try {
        const directTx = await servingContract.depositFund(
          userAddress,
          config.PROVIDER_ADDRESS,
          0,
          { value: amount }
        );
        
        console.log('✅ Direct deposit transaction sent:', directTx.hash);
        
        const directReceipt = await directTx.wait();
        console.log('✅ Direct deposit confirmed:', directReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } catch (directError) {
        console.log('❌ Direct deposit failed:', directError.message);
      }
    } else {
      // Try direct account creation
      console.log('Testing direct account creation to serving contract...');
      try {
        const directAddTx = await servingContract.addAccount(
          userAddress,
          config.PROVIDER_ADDRESS,
          'INFT Platform User',
          { value: amount }
        );
        
        console.log('✅ Direct account creation transaction sent:', directAddTx.hash);
        
        const directAddReceipt = await directAddTx.wait();
        console.log('✅ Direct account creation confirmed:', directAddReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } catch (directAddError) {
        console.log('❌ Direct account creation failed:', directAddError.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSDKIntegration().catch(console.error);