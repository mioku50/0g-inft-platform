const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testCorrectSDKAPI() {
  console.log('🧪 Testing Correct SDK API Usage');
  console.log('=================================');

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

    // 3. Test deposit with correct API usage (only amount parameter)
    console.log('\n3. Testing deposit with correct API...');
    const depositAmount = 0.01; // Amount in A0GI (according to docs)
    
    try {
      // According to docs: await broker.ledger.depositFund(amount)
      const depositTx = await broker.ledger.depositFund(depositAmount);
      
      console.log('✅ Deposit transaction sent:', depositTx.hash);
      console.log('🔗 Transaction URL: https://chainscan-galileo.0g.ai/tx/' + depositTx.hash);
      
      const depositReceipt = await depositTx.wait();
      console.log('✅ Deposit confirmed:', depositReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
    } catch (depositError) {
      console.log('❌ Deposit failed:', depositError.message);
      
      // If deposit fails, try creating account first
      if (depositError.message.includes('AccountNotExists') || depositError.message.includes('Ledger already exists')) {
        console.log('\n4. Trying account creation instead...');
        try {
          // According to docs: await broker.ledger.addLedger(balance)
          const createTx = await broker.ledger.addLedger(depositAmount);
          
          console.log('✅ Account creation transaction sent:', createTx.hash);
          console.log('🔗 Transaction URL: https://chainscan-galileo.0g.ai/tx/' + createTx.hash);
          
          const createReceipt = await createTx.wait();
          console.log('✅ Account creation confirmed:', createReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
          
        } catch (createError) {
          console.log('❌ Account creation also failed:', createError.message);
        }
      }
    }

    // 5. Test other SDK methods
    console.log('\n5. Testing other SDK methods...');
    
    // List services
    try {
      const services = await broker.listService();
      console.log('✅ Listed services:', services.length, 'services found');
      
      const ourProvider = services.find(s => s.provider.toLowerCase() === config.PROVIDER_ADDRESS.toLowerCase());
      if (ourProvider) {
        console.log('Our provider service:', {
          serviceType: ourProvider.serviceType,
          url: ourProvider.url,
          inputPrice: ourProvider.inputPrice.toString(),
          outputPrice: ourProvider.outputPrice.toString(),
          model: ourProvider.model,
          verifiability: ourProvider.verifiability
        });
      }
    } catch (serviceError) {
      console.log('❌ Failed to list services:', serviceError.message);
    }

    // Get service metadata
    try {
      const { endpoint, model } = await broker.getServiceMetadata(config.PROVIDER_ADDRESS);
      console.log('✅ Service metadata:', { endpoint, model });
    } catch (metadataError) {
      console.log('❌ Failed to get service metadata:', metadataError.message);
    }

    // Acknowledge provider
    try {
      const ackTx = await broker.acknowledgeProvider(config.PROVIDER_ADDRESS);
      console.log('✅ Provider acknowledgment sent:', ackTx.hash);
      
      const ackReceipt = await ackTx.wait();
      console.log('✅ Provider acknowledgment confirmed:', ackReceipt.status === 1 ? 'SUCCESS' : 'FAILED');
    } catch (ackError) {
      console.log('❌ Provider acknowledgment failed:', ackError.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCorrectSDKAPI().catch(console.error);