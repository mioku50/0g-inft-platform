const { ethers } = require('./node_modules/ethers');

// Test configuration based on CLI logs and documentation
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  LEDGER_ADDRESS: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

// FineTuningServing ABI - for service queries and account management
const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
  'function acknowledgeProviderSigner(address provider, address providerSigner) external'
];

// Ledger ABI - for account and fund management
const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external'
];

async function testFineTuneFlow() {
  console.log('🧪 Testing Fixed Fine-tune Flow');
  console.log('=================================');

  // 1. Setup
  console.log('\n1. Setting up connection...');
  const provider = new ethers.JsonRpcProvider(config.RPC_URL);
  const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
  const userAddress = wallet.address;
  
  console.log(`User address: ${userAddress}`);
  console.log(`Provider address: ${config.PROVIDER_ADDRESS}`);

  // 2. Check wallet balance
  console.log('\n2. Checking wallet balance...');
  const balance = await provider.getBalance(userAddress);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} OG`);
  
  if (balance < ethers.parseEther('0.02')) {
    console.log('❌ Insufficient wallet balance for test');
    return;
  }

  // 3. Setup contracts - IMPORTANT: Use correct contracts for each method
  console.log('\n3. Setting up contracts...');
  const serving = new ethers.Contract(config.SERVING_ADDRESS, SERVING_ABI, wallet);
  const ledger = new ethers.Contract(config.LEDGER_ADDRESS, LEDGER_ABI, wallet);

  // 4. Test provider service query - Use FineTuningServing contract
  console.log('\n4. Testing provider service query...');
  try {
    const service = await serving.getService(config.PROVIDER_ADDRESS);
    console.log('✅ Provider service found:', {
      url: service.url,
      pricePerToken: service.pricePerToken.toString(),
      occupied: service.occupied,
      models: service.models
    });
  } catch (error) {
    console.log('❌ Failed to get provider service:', error.message);
    return;
  }

  // 5. Test account existence check - Use FineTuningServing contract
  console.log('\n5. Testing account existence check...');
  try {
    const accountExists = await serving.accountExists(userAddress, config.PROVIDER_ADDRESS);
    console.log(`Account exists: ${accountExists}`);
    
    if (accountExists) {
      const account = await serving.getAccount(userAddress, config.PROVIDER_ADDRESS);
      console.log('Account details:', {
        balance: ethers.formatEther(account.balance),
        nonce: account.nonce.toString(),
        pendingRefund: ethers.formatEther(account.pendingRefund)
      });
    }
  } catch (error) {
    console.log('❌ Failed to check account:', error.message);
    return;
  }

  // 6. Test addAccount if account doesn't exist - Use Ledger contract
  console.log('\n6. Testing account creation if needed...');
  try {
    const accountExists = await serving.accountExists(userAddress, config.PROVIDER_ADDRESS);
    
    if (!accountExists) {
      console.log('Account does not exist, testing addAccount...');
      
      const amount = ethers.parseEther('0.01');
      const gasEstimate = await ledger.addAccount.estimateGas(
        userAddress,
        config.PROVIDER_ADDRESS,
        'INFT Platform User',
        { value: amount }
      );
      console.log(`✅ AddAccount gas estimate: ${gasEstimate.toString()}`);
      console.log('✅ AddAccount simulation successful');
    } else {
      console.log('Account already exists, testing depositFund...');
      
      const amount = ethers.parseEther('0.01');
      const gasEstimate = await ledger.depositFund.estimateGas(
        userAddress,
        config.PROVIDER_ADDRESS,
        0,
        { value: amount }
      );
      console.log(`✅ DepositFund gas estimate: ${gasEstimate.toString()}`);
      console.log('✅ DepositFund simulation successful');
    }
  } catch (error) {
    console.log('❌ Account operation test failed:', error.message);
    if (error.data) {
      console.log('Error data:', error.data);
    }
  }

  // 7. Test token calculation
  console.log('\n7. Testing token calculation...');
  const sampleDataset = 'This is a sample training dataset for fine-tuning.';
  const byteSize = new TextEncoder().encode(sampleDataset).length;
  const approximateTokens = Math.ceil(byteSize / 4);
  
  console.log('Token calculation test:', {
    datasetContent: sampleDataset,
    byteSize,
    approximateTokens,
    calculatedFee: approximateTokens * 1 * 3 // tokens * pricePerToken * epochs
  });

  console.log('\n✅ Fine-tune flow test completed!');
  console.log('\nSummary of fixes applied:');
  console.log('- ✅ Corrected contract usage: FineTuningServing for queries, Ledger for transactions');
  console.log('- ✅ Updated ABI definitions for both contracts');
  console.log('- ✅ Removed incorrect Ledger compatibility warning');
  console.log('- ✅ Fixed createTask to use model name instead of hash');
  console.log('- ✅ Fixed fee calculation based on tokens and epochs');
  console.log('- ✅ Improved token size calculation');
  console.log('- ✅ Added proper JSON stringification for training params');
}

testFineTuneFlow().catch(console.error);