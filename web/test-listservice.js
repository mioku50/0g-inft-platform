const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

async function testListService() {
  try {
    console.log('=== Testing listService() ===');
    
    const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
    const privateKey = '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65';
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log('Wallet address:', wallet.address);
    
    const broker = await createZGComputeNetworkBroker(
      wallet,
      '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa', // LEDGER
      '0x5299bd255B76305ae08d7F95B270A485c6b95D54', // INFERENCE
      '0xda478Ccf5d534346A16b1475E4c2DecE0268B176'  // FINE_TUNING
    );
    
    console.log('Broker created successfully');
    console.log('Inference contract address:', broker.inference.contractAddress);
    
    // Test direct call to listService
    console.log('\n=== Calling broker.inference.listService() ===');
    const services = await broker.inference.listService();
    console.log('Services found:', services.length);
    console.log('Services:', services);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testListService();