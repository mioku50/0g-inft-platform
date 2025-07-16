const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

async function debugSDK() {
  console.log('=== SDK Debug ===\n');
  
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  const privateKey = '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65';
  const wallet = new ethers.Wallet(privateKey, provider);
  
  try {
    // Пытаемся создать broker с пустым адресом
    console.log('Creating broker with default addresses...');
    const broker = await createZGComputeNetworkBroker(wallet);
    
    console.log('\nBroker created! Checking contracts:');
    
    // Проверяем адреса внутри broker
    if (broker.ledger && broker.ledger.contract) {
      console.log('Ledger address:', broker.ledger.contract.address || broker.ledger.contract.target);
    }
    
    if (broker.inference && broker.inference.contract) {
      console.log('Inference address:', broker.inference.contract.address || broker.inference.contract.target);
    }
    
    if (broker.fineTuning && broker.fineTuning.contract) {
      console.log('FineTuning address:', broker.fineTuning.contract.address || broker.fineTuning.contract.target);
    }
    
  } catch (error) {
    console.error('\nError creating broker:', error.message);
    
    // Пробуем с явными адресами
    console.log('\nTrying with explicit contract address...');
    try {
      const broker2 = await createZGComputeNetworkBroker(
        wallet,
        '0xE7F0998C83a81f04871BEdfD89aB5f2DAcDBf435' // адрес из upgrade_verifier.ts
      );
      console.log('Success with explicit address!');
    } catch (err2) {
      console.error('Also failed:', err2.message);
    }
  }
}

debugSDK();
