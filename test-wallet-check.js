const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  SERVER_PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testWalletMismatch() {
  console.log('🧪 Testing Wallet Address Mismatch');
  console.log('==================================\n');

  try {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    
    // 1. Server wallet (from OG_COMPUTE_PRIVATE_KEY)
    console.log('1. Server wallet (backend):');
    const serverWallet = new ethers.Wallet(config.SERVER_PRIVATE_KEY, provider);
    console.log('Address:', serverWallet.address);
    
    const serverBroker = await createZGComputeNetworkBroker(serverWallet);
    try {
      const serverLedger = await serverBroker.ledger.getLedger();
      console.log('Ledger balance:', ethers.formatEther(serverLedger.ledgerInfo[0]), 'OG\n');
    } catch (e) {
      console.log('No ledger account\n');
    }
    
    // 2. Example user wallet (from screenshot)
    console.log('2. User wallet (frontend):');
    // This would be the address from the screenshot
    const userAddress = '0x1234...'; // Replace with actual user address from screenshot
    console.log('Address:', userAddress);
    console.log('Note: This is the wallet connected in the browser\n');
    
    // 3. The issue
    console.log('3. THE PROBLEM:');
    console.log('- Frontend shows balance for USER wallet:', userAddress);
    console.log('- Backend uses SERVER wallet:', serverWallet.address);
    console.log('- Ledger accounts are wallet-specific!');
    console.log('- That\'s why frontend shows 0.0 OG\n');
    
    console.log('4. SOLUTION OPTIONS:');
    console.log('Option 1: Use a shared ledger account model');
    console.log('Option 2: Let users manage their own ledger accounts');
    console.log('Option 3: Display server wallet balance in UI with clear labeling');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testWalletMismatch().catch(console.error);