const { ethers } = require('ethers');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testDirectCalls() {
  console.log('🧪 Testing Direct Contract Calls');
  console.log('================================');

  try {
    // 1. Setup provider and wallet
    console.log('\n1. Setting up provider and wallet...');
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const userAddress = wallet.address;
    
    console.log(`User address: ${userAddress}`);
    console.log(`Provider address: ${config.PROVIDER_ADDRESS}`);

    // 2. Setup contract
    console.log('\n2. Setting up contract...');
    const servingAbi = [
      'function accountExists(address user, address provider) view returns (bool)',
      'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
      'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
      'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable'
    ];
    
    const servingContract = new ethers.Contract(config.SERVING_ADDRESS, servingAbi, wallet);

    // 3. Check provider
    console.log('\n3. Checking provider...');
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

    // 4. Check account
    console.log('\n4. Checking account...');
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
      } else {
        console.log('❌ Account does not exist - cannot test deposit');
        return;
      }
    } catch (accountError) {
      console.log('❌ Account check failed:', accountError.message);
      return;
    }

    // 5. Test direct deposit
    console.log('\n5. Testing direct deposit...');
    try {
      const amount = ethers.parseEther('0.01');
      
      // Estimate gas first
      const gasEstimate = await servingContract.depositFund.estimateGas(
        userAddress,
        config.PROVIDER_ADDRESS,
        0,
        { value: amount }
      );
      console.log('✅ Gas estimate:', gasEstimate.toString());
      
      // Execute transaction
      const tx = await servingContract.depositFund(
        userAddress,
        config.PROVIDER_ADDRESS,
        0,
        { value: amount }
      );
      
      console.log('✅ Transaction sent:', tx.hash);
      console.log('🔗 Transaction URL: https://chainscan-galileo.0g.ai/tx/' + tx.hash);
      
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
      
      // Check updated balance
      console.log('\n6. Checking updated balance...');
      const updatedAccount = await servingContract.getAccount(userAddress, config.PROVIDER_ADDRESS);
      console.log('Updated account details:', {
        balance: ethers.formatEther(updatedAccount.balance),
        nonce: updatedAccount.nonce.toString(),
        pendingRefund: ethers.formatEther(updatedAccount.pendingRefund)
      });
      
    } catch (depositError) {
      console.log('❌ Direct deposit failed:', depositError.message);
      
      // Check if it's a "Caller is not the ledger contract" error
      if (depositError.message.includes('Caller is not the ledger contract')) {
        console.log('💡 This confirms that FineTuningServing requires calls from Ledger contract');
        console.log('💡 Direct calls to FineTuningServing are not allowed');
        console.log('💡 We need to use the correct Ledger contract or SDK methods');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDirectCalls().catch(console.error);