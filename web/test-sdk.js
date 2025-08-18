const { JsonRpcProvider, Wallet } = require('ethers');
require('dotenv').config({ path: '.env.local' });

async function testSDK() {
  try {
    const rpc = process.env.NEXT_PUBLIC_0G_RPC_URL;
    const pk = process.env.OG_COMPUTE_PRIVATE_KEY;
    
    console.log('RPC URL:', rpc);
    console.log('Private Key provided:', !!pk);
    
    const contracts = {
      inference: process.env.NEXT_PUBLIC_COMPUTE_INFERENCE_CONTRACT,
      ledger: process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT,
      fineTuning: process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS,
    };
    console.log('Contracts:', contracts);
    
    const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
    console.log('✅ SDK loaded successfully');
    
    const provider = new JsonRpcProvider(rpc);
    const wallet = new Wallet(pk, provider);
    
    console.log('Testing network connectivity...');
    const network = await provider.getNetwork();
    console.log('Chain ID:', network.chainId.toString());
    
    console.log('Creating broker...');
    const broker = await createZGComputeNetworkBroker(wallet, contracts.ledger, contracts.inference, contracts.fineTuning);
    
    console.log('Listing services...');
    const services = await broker.inference.listService();
    
    console.log('Services found:', services.length);
    if (services.length > 0) {
      console.log('Services details:');
      services.forEach((s, i) => {
        console.log(`  ${i+1}. Model: ${s.model}, Provider: ${s.provider.slice(0,10)}...`);
      });
    } else {
      console.log('❌ No services found - this is the root cause of the issue');
    }
    
    // Test ledger
    console.log('\nTesting ledger...');
    const ledger = await broker.ledger.getLedger();
    console.log('Ledger balance:', require('ethers').formatEther(ledger.balance), 'OG');
    
  } catch(error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testSDK();