const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testAccountManagement() {
  console.log('🧪 Testing Account Management with SDK');
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

    // 3. Test getAccount method
    console.log('\n3. Testing getAccount method...');
    try {
      const account = await broker.fineTuning.getAccount(userAddress, config.PROVIDER_ADDRESS);
      console.log('✅ Account retrieved:', {
        user: account.user,
        provider: account.provider,
        balance: ethers.formatEther(account.balance),
        nonce: account.nonce.toString(),
        pendingRefund: ethers.formatEther(account.pendingRefund)
      });
    } catch (accountError) {
      console.log('❌ Failed to get account:', accountError.message);
    }

    // 4. Test getAccountWithDetail method
    console.log('\n4. Testing getAccountWithDetail method...');
    try {
      const detailedAccount = await broker.fineTuning.getAccountWithDetail(userAddress, config.PROVIDER_ADDRESS);
      console.log('✅ Detailed account retrieved:', {
        balance: ethers.formatEther(detailedAccount.balance),
        pendingRefund: ethers.formatEther(detailedAccount.pendingRefund),
        refundsCount: detailedAccount.refunds?.length || 0,
        deliverablesCount: detailedAccount.deliverables?.length || 0
      });
    } catch (detailError) {
      console.log('❌ Failed to get detailed account:', detailError.message);
    }

    // 5. Test listService method
    console.log('\n5. Testing listService method...');
    try {
      const services = await broker.fineTuning.listService();
      console.log('✅ Services retrieved:', services.length, 'services found');
      
      // Find our provider
      const ourProvider = services.find(s => s.provider.toLowerCase() === config.PROVIDER_ADDRESS.toLowerCase());
      if (ourProvider) {
        console.log('Our provider details:', {
          url: ourProvider.url,
          pricePerToken: ourProvider.pricePerToken.toString(),
          occupied: ourProvider.occupied,
          modelsCount: ourProvider.models?.length || 0
        });
      }
    } catch (serviceError) {
      console.log('❌ Failed to list services:', serviceError.message);
    }

    // 6. Check what the CLI actually uses for account operations
    console.log('\n6. Analyzing CLI-style operations...');
    
    // Based on CLI logs, it seems we need to use the CLI directly
    console.log('The CLI uses internal methods that are not exposed in the SDK.');
    console.log('Let\'s check if we can use the low-level broker methods...');

    // 7. Try to access internal broker methods
    console.log('\n7. Exploring broker internals...');
    console.log('Broker keys:', Object.keys(broker));
    
    if (broker.ledger) {
      console.log('Ledger methods:', Object.getOwnPropertyNames(broker.ledger).filter(name => typeof broker.ledger[name] === 'function'));
    }
    
    if (broker.serving) {
      console.log('Serving methods:', Object.getOwnPropertyNames(broker.serving).filter(name => typeof broker.serving[name] === 'function'));
    }

    // 8. Test if we can access the contracts directly
    console.log('\n8. Testing direct contract access...');
    try {
      // Get the contract instances from broker
      if (broker.ledger && broker.ledger.addAccount) {
        console.log('✅ Ledger addAccount method available');
        
        const amount = ethers.parseEther('0.01');
        const tx = await broker.ledger.addAccount(
          userAddress,
          config.PROVIDER_ADDRESS,
          'INFT Platform User',
          { value: amount }
        );
        
        console.log('✅ Ledger addAccount transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } else if (broker.ledger && broker.ledger.depositFund) {
        console.log('✅ Ledger depositFund method available');
        
        const amount = ethers.parseEther('0.01');
        const tx = await broker.ledger.depositFund(
          userAddress,
          config.PROVIDER_ADDRESS,
          0,
          { value: amount }
        );
        
        console.log('✅ Ledger depositFund transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
      } else {
        console.log('❌ No suitable ledger methods found');
      }
    } catch (contractError) {
      console.log('❌ Direct contract access failed:', contractError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAccountManagement().catch(console.error);