const { ethers } = require('ethers');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  LEDGER_ADDRESS: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

// Contract ABIs with more complete method signatures
const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))',
  'function acknowledgeProviderSigner(address provider, address providerSigner) external'
];

const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external'
];

async function main() {
  console.log('🔍 Fine-tune Deposit Flow Debug');
  console.log('================================');

  // 1. Setup provider and wallet
  console.log('\n1. Setting up provider and wallet...');
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
    console.log('❌ Insufficient wallet balance for deposit');
    return;
  }

  // 3. Check contract deployments
  console.log('\n3. Checking contract deployments...');
  const servingCode = await provider.getCode(config.SERVING_ADDRESS);
  const ledgerCode = await provider.getCode(config.LEDGER_ADDRESS);
  
  console.log(`Serving contract: ${servingCode !== '0x' ? '✅ Deployed' : '❌ Not deployed'}`);
  console.log(`Ledger contract: ${ledgerCode !== '0x' ? '✅ Deployed' : '❌ Not deployed'}`);

  if (servingCode === '0x' || ledgerCode === '0x') {
    console.log('❌ Contracts not deployed');
    return;
  }

  // 4. Setup contract instances
  const serving = new ethers.Contract(config.SERVING_ADDRESS, SERVING_ABI, wallet);
  const ledger = new ethers.Contract(config.LEDGER_ADDRESS, LEDGER_ABI, wallet);

  // 5. Check provider registration
  console.log('\n4. Checking provider registration...');
  try {
    const service = await serving.getService(config.PROVIDER_ADDRESS);
    console.log(`Provider URL: ${service.url}`);
    console.log(`Provider signer: ${service.providerSigner}`);
    console.log(`Price per token: ${service.pricePerToken.toString()}`);
    console.log('✅ Provider is registered');
    
    // Check if provider signer is acknowledged
    if (service.providerSigner === '0x0000000000000000000000000000000000111111') {
      console.log('⚠️  Provider signer looks like a placeholder address');
    }
  } catch (error) {
    console.log('❌ Provider not registered:', error.message);
    return;
  }

  // 6. Check if account already exists
  console.log('\n5. Checking account status...');
  const accountExists = await serving.accountExists(userAddress, config.PROVIDER_ADDRESS);
  console.log(`Account exists: ${accountExists}`);

  if (accountExists) {
    const account = await serving.getAccount(userAddress, config.PROVIDER_ADDRESS);
    console.log(`Current balance: ${ethers.formatEther(account.balance)} OG`);
    console.log(`Pending refund: ${ethers.formatEther(account.pendingRefund)} OG`);
    console.log(`Nonce: ${account.nonce.toString()}`);
  }

  // 7. Try to acknowledge provider signer first (if needed)
  console.log('\n6. Checking provider signer acknowledgment...');
  try {
    // This might be needed before creating accounts
    const service = await serving.getService(config.PROVIDER_ADDRESS);
    if (service.providerSigner !== ethers.ZeroAddress) {
      console.log('Provider signer is set, attempting to acknowledge...');
      try {
        const ackTx = await serving.acknowledgeProviderSigner(config.PROVIDER_ADDRESS, service.providerSigner);
        console.log(`Provider signer acknowledgment sent: ${ackTx.hash}`);
        await ackTx.wait();
        console.log('✅ Provider signer acknowledged');
      } catch (ackError) {
        console.log('Provider signer acknowledgment failed (might already be acknowledged):', ackError.message);
      }
    }
  } catch (error) {
    console.log('Could not check provider signer:', error.message);
  }

  // 8. Test transaction simulation
  console.log('\n7. Testing transaction simulation...');
  const amount = ethers.parseEther('0.01');
  
  try {
    if (accountExists) {
      console.log('Testing deposit simulation...');
      const gasEstimate = await ledger.depositFund.estimateGas(
        userAddress, 
        config.PROVIDER_ADDRESS, 
        0, 
        { value: amount }
      );
      console.log(`✅ Deposit gas estimate: ${gasEstimate.toString()}`);
    } else {
      console.log('Testing addAccount simulation...');
      const gasEstimate = await ledger.addAccount.estimateGas(
        userAddress, 
        config.PROVIDER_ADDRESS, 
        'INFT Platform User',
        { value: amount }
      );
      console.log(`✅ AddAccount gas estimate: ${gasEstimate.toString()}`);
    }
  } catch (error) {
    console.log('❌ Transaction simulation failed:', error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log('Error data:', error.data);
    }
    
    // Try with a different approach - direct call to see what happens
    console.log('\n8. Trying direct contract call for more details...');
    try {
      const result = await ledger.addAccount.staticCall(
        userAddress, 
        config.PROVIDER_ADDRESS, 
        'INFT Platform User',
        { value: amount }
      );
      console.log('Static call succeeded:', result);
    } catch (staticError) {
      console.log('Static call also failed:', staticError.message);
      if (staticError.data) {
        console.log('Static call error data:', staticError.data);
      }
    }
    return;
  }

  // 9. Execute actual transaction
  console.log('\n9. Executing transaction...');
  try {
    let tx;
    if (accountExists) {
      console.log('Executing deposit...');
      tx = await ledger.depositFund(userAddress, config.PROVIDER_ADDRESS, 0, { value: amount });
    } else {
      console.log('Executing addAccount...');
      tx = await ledger.addAccount(userAddress, config.PROVIDER_ADDRESS, 'INFT Platform User', { value: amount });
    }
    
    console.log(`✅ Transaction sent: ${tx.hash}`);
    console.log(`Explorer URL: https://explorer-testnet.0g.ai/tx/${tx.hash}`);
    
    // Wait for confirmation
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait(1);
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
    // Check final balance
    console.log('\n10. Checking final balance...');
    const finalAccount = await serving.getAccount(userAddress, config.PROVIDER_ADDRESS);
    console.log(`Final balance: ${ethers.formatEther(finalAccount.balance)} OG`);
    
  } catch (error) {
    console.log('❌ Transaction execution failed:', error.message);
    if (error.data) {
      console.log('Error data:', error.data);
    }
  }
}

main().catch(console.error);