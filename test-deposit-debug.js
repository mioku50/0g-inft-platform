const { ethers } = require('./node_modules/ethers');

// Environment configuration
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  LEDGER_ADDRESS: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

// Contract ABIs
const SERVING_ABI = [
  'function accountExists(address user, address provider) view returns (bool)',
  'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
  'function getService(address provider) view returns (tuple(address provider,string url,(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))'
];

const LEDGER_ABI = [
  'function addAccount(address user, address provider, string additionalInfo) payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable',
  'function requestRefundAll(address user, address provider)'
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

  // 7. Test transaction simulation
  console.log('\n6. Testing transaction simulation...');
  const amount = ethers.parseEther('0.01');
  
  try {
    if (accountExists) {
      console.log('Testing deposit simulation...');
      const gasEstimate = await ledger.estimateGas.depositFund(
        userAddress, 
        config.PROVIDER_ADDRESS, 
        0, 
        { value: amount }
      );
      console.log(`✅ Deposit gas estimate: ${gasEstimate.toString()}`);
    } else {
      console.log('Testing addAccount simulation...');
      const gasEstimate = await ledger.estimateGas.addAccount(
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
    return;
  }

  // 8. Execute actual transaction
  console.log('\n7. Executing transaction...');
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
    console.log('\n8. Checking final balance...');
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