/**
 * Direct test of the 0G broker service discovery
 * Can be run with node directly to debug issues
 */

async function testBrokerDiscovery() {
  console.log('🔍 Testing 0G Broker Service Discovery');
  console.log('=====================================\n');

  try {
    // Dynamic imports for ES modules
    const { ethers } = await import('ethers');
    const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker');
    
    // Load environment
    const fs = require('fs');
    const path = require('path');
    
    function getEnvVar(name) {
      try {
        const envPath = path.join(__dirname, '../.env.local');
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(new RegExp(`${name}=([^\\n]+)`));
        return match ? match[1].trim() : null;
      } catch (error) {
        console.warn(`Could not read ${name} from .env.local:`, error.message);
        return null;
      }
    }

    // Configuration
    const RPC_URL = 'https://evmrpc-testnet.0g.ai';
    const LEDGER_CONTRACT = '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa';
    const INFERENCE_CONTRACT = '0x5299bd255B76305ae08d7F95B270A485c6b95D54';
    const FINE_TUNING_CONTRACT = '0xda478Ccf5d534346A16b1475E4c2DecE0268B176';
    
    const privateKey = getEnvVar('OG_COMPUTE_PRIVATE_KEY') || getEnvVar('OG_STORAGE_PRIVATE_KEY');
    
    if (!privateKey) {
      console.error('❌ No private key found in .env.local');
      console.log('Please set OG_COMPUTE_PRIVATE_KEY or OG_STORAGE_PRIVATE_KEY');
      return;
    }

    console.log('1️⃣ Initializing provider and wallet...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(`Wallet address: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} OG\n`);

    console.log('2️⃣ Creating broker...');
    const broker = await createZGComputeNetworkBroker(
      wallet,
      LEDGER_CONTRACT,
      INFERENCE_CONTRACT,
      FINE_TUNING_CONTRACT
    );
    console.log('✅ Broker created successfully\n');

    console.log('3️⃣ Testing service discovery...');
    try {
      const services = await broker.inference.listService();
      console.log(`Found ${services.length} services from contract:`);
      
      if (services.length > 0) {
        services.forEach((service, i) => {
          console.log(`  Service ${i + 1}:`);
          console.log(`    Provider: ${service.provider}`);
          console.log(`    Model: ${service.model}`);
          console.log(`    URL: ${service.url}`);
          console.log(`    Type: ${service.serviceType}`);
          console.log(`    Verifiability: ${service.verifiability}\n`);
        });
      } else {
        console.log('  No services found in contract');
      }
      
    } catch (error) {
      console.log('❌ Service discovery failed:', error.message);
    }

    console.log('4️⃣ Testing specific provider metadata...');
    const testProviders = [
      '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
    ];

    for (const providerAddress of testProviders) {
      console.log(`\nTesting provider: ${providerAddress}`);
      try {
        const metadata = await broker.inference.getServiceMetadata(providerAddress);
        console.log(`  ✅ Success: ${metadata.model} at ${metadata.endpoint}`);
      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}`);
        
        if (error.message.includes('ServiceNotExist')) {
          console.log(`  📋 Provider not registered in inference contract`);
        }
      }
    }

    console.log('\n5️⃣ Testing ledger account...');
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      console.log(`✅ Ledger found: ${ethers.formatEther(ledgerInfo.balance)} OG`);
    } catch (error) {
      console.log(`❌ Ledger error: ${error.message}`);
      if (error.message.includes('not found')) {
        console.log('📋 No ledger account exists, need to create one');
      }
    }

    console.log('\n📊 Discovery Test Complete');
    console.log('==========================');
    console.log('If providers show "ServiceNotExist", they are not registered in the contract.');
    console.log('The chat service should fall back to hardcoded endpoints in this case.');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testBrokerDiscovery().catch(console.error);