const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

async function checkMethods() {
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  const privateKey = '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65';
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const broker = await createZGComputeNetworkBroker(
    wallet,
    '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
    '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
    '0xda478Ccf5d534346A16b1475E4c2DecE0268B176'
  );
  
  console.log('=== Broker Structure ===');
  console.log('Broker keys:', Object.keys(broker));
  
  if (broker.inference) {
    console.log('\nInference methods:', Object.keys(broker.inference));
  }
  
  if (broker.ledger) {
    console.log('\nLedger methods:', Object.keys(broker.ledger));
  }
  
  // Пробуем найти метод для списка сервисов
  const possibleMethods = ['listService', 'getServices', 'listServices', 'getProviders', 'listProviders'];
  
  console.log('\n=== Checking possible service list methods ===');
  possibleMethods.forEach(method => {
    if (broker[method]) console.log(`✓ broker.${method} exists`);
    if (broker.inference && broker.inference[method]) console.log(`✓ broker.inference.${method} exists`);
  });
}

checkMethods().catch(console.error);
