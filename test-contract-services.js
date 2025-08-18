#!/usr/bin/env node

/**
 * Test script to check if the InferenceServing contract is accessible and has services
 * This will help debug the chat service issues
 */

const { ethers } = require('ethers');

// Contract configuration from .env
const INFERENCE_CONTRACT = '0x5299bd255B76305ae08d7F95B270A485c6b95D54';
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16601; // Galileo v3

// Updated ABI that matches the SDK
const INFERENCE_SERVING_ABI = [
  {
    "inputs": [],
    "name": "getAllServices",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "string", "name": "serviceType", "type": "string" },
          { "internalType": "string", "name": "url", "type": "string" },
          { "internalType": "uint256", "name": "inputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "outputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
          { "internalType": "string", "name": "model", "type": "string" },
          { "internalType": "string", "name": "verifiability", "type": "string" },
          { "internalType": "string", "name": "additionalInfo", "type": "string" }
        ],
        "internalType": "struct InferenceServing.ServiceStruct[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "provider", "type": "address" }
    ],
    "name": "getService",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "provider", "type": "address" },
          { "internalType": "string", "name": "serviceType", "type": "string" },
          { "internalType": "string", "name": "url", "type": "string" },
          { "internalType": "uint256", "name": "inputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "outputPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "updatedAt", "type": "uint256" },
          { "internalType": "string", "name": "model", "type": "string" },
          { "internalType": "string", "name": "verifiability", "type": "string" },
          { "internalType": "string", "name": "additionalInfo", "type": "string" }
        ],
        "internalType": "struct InferenceServing.ServiceStruct",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Provider addresses to test
const TEST_PROVIDERS = [
  '0xf07240Efa67755B5311bc75784a061eDB47165Dd', // llama-3.3-70b-instruct
  '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'  // deepseek-r1-70b
];

async function testContract() {
  console.log('🔍 Testing InferenceServing Contract');
  console.log('=====================================');
  console.log(`Contract: ${INFERENCE_CONTRACT}`);
  console.log(`Network: ${RPC_URL} (Chain ID: ${CHAIN_ID})`);
  console.log('');

  try {
    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Test network connectivity
    console.log('📡 Testing network connectivity...');
    const network = await provider.getNetwork();
    console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (Number(network.chainId) !== CHAIN_ID) {
      console.warn(`⚠️  Warning: Expected chain ID ${CHAIN_ID}, got ${network.chainId}`);
    }
    console.log('');

    // Create contract instance
    console.log('📜 Testing contract accessibility...');
    const contract = new ethers.Contract(INFERENCE_CONTRACT, INFERENCE_SERVING_ABI, provider);
    
    // Test if contract exists (try to call a simple view function)
    try {
      const services = await contract.getAllServices();
      console.log(`✅ Contract is accessible`);
      console.log(`📊 Found ${services.length} services on contract`);
      console.log('');

      if (services.length > 0) {
        console.log('🛠️  Registered Services:');
        console.log('=======================');
        
        services.forEach((service, index) => {
          console.log(`Service ${index + 1}:`);
          console.log(`  Provider: ${service.provider}`);
          console.log(`  Model: ${service.model}`);
          console.log(`  Service Type: ${service.serviceType}`);
          console.log(`  URL: ${service.url}`);
          console.log(`  Verifiability: ${service.verifiability}`);
          console.log(`  Input Price: ${ethers.formatEther(service.inputPrice)} OG`);
          console.log(`  Output Price: ${ethers.formatEther(service.outputPrice)} OG`);
          console.log(`  Updated At: ${new Date(Number(service.updatedAt) * 1000).toISOString()}`);
          if (service.additionalInfo) {
            console.log(`  Additional Info: ${service.additionalInfo.substring(0, 100)}...`);
          }
          console.log('');
        });
      } else {
        console.log('⚠️  No services found on contract');
        console.log('   This explains why the chat service fails with "No services from contract"');
        console.log('');
      }

    } catch (contractError) {
      console.log(`❌ Contract call failed: ${contractError.message}`);
      console.log('   This suggests either:');
      console.log('   1. The contract address is wrong');
      console.log('   2. The ABI structure is incorrect');
      console.log('   3. The contract doesn\'t exist on this network');
      console.log('');
    }

    // Test individual provider lookup
    console.log('🔍 Testing individual provider lookup...');
    console.log('========================================');
    
    for (const providerAddr of TEST_PROVIDERS) {
      try {
        console.log(`Testing provider: ${providerAddr}`);
        const service = await contract.getService(providerAddr);
        console.log(`✅ Provider found:`);
        console.log(`   Model: ${service.model}`);
        console.log(`   URL: ${service.url}`);
        console.log(`   Verifiability: ${service.verifiability}`);
        console.log('');
      } catch (providerError) {
        console.log(`❌ Provider not found: ${providerError.message}`);
        if (providerError.message.includes('ServiceNotExist')) {
          console.log('   This provider is not registered on the contract');
        }
        console.log('');
      }
    }

    // Check if there are any other providers
    console.log('🔎 Contract Analysis Summary:');
    console.log('==============================');
    
    try {
      const allServices = await contract.getAllServices();
      const registeredProviders = allServices.map(s => s.provider.toLowerCase());
      const testProviders = TEST_PROVIDERS.map(p => p.toLowerCase());
      
      console.log(`Total services on contract: ${allServices.length}`);
      console.log(`Expected providers: ${TEST_PROVIDERS.length}`);
      console.log(`Registered providers: ${registeredProviders.join(', ')}`);
      
      const missingProviders = testProviders.filter(p => !registeredProviders.includes(p));
      if (missingProviders.length > 0) {
        console.log(`❌ Missing providers: ${missingProviders.join(', ')}`);
        console.log('   These providers need to be registered on the contract');
      } else {
        console.log('✅ All expected providers are registered');
      }
      
      const extraProviders = registeredProviders.filter(p => !testProviders.includes(p));
      if (extraProviders.length > 0) {
        console.log(`ℹ️  Additional providers found: ${extraProviders.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ Failed to analyze contract: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('Possible solutions:');
    console.log('1. Check if the RPC URL is correct and accessible');
    console.log('2. Verify the contract address for Galileo v3 (16601)');
    console.log('3. Check if the contract is deployed on this network');
    console.log('4. Ensure the ABI matches the deployed contract');
  }
}

// Run the test
testContract().catch(console.error);