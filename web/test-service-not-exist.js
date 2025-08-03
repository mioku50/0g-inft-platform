#!/usr/bin/env node

/**
 * Test ServiceNotExist handling in fine-tuning system
 * Simulates the exact scenario from the problem statement
 */

const fetch = require('node-fetch');

const TEST_DATA = {
  agentId: 29,
  userAddress: '0x432330379Af04Dd2770557C711d82f88072cE3d5',
  providerAddress: '0x960E74Fc0AF1a6fBcADA3eEFCBe3152fA5E87A5f', // unregistered provider
  datasetHash: '0xd0dcd65a1ef28c71952a35bc6bf75a45ae4d3d384850bf779301f6ac079b0fed',
  modelId: 'distilbert-base-uncased',
  datasetSize: 1024
};

async function testServiceNotExistHandling() {
  console.log('🧪 Testing ServiceNotExist handling in fine-tuning system');
  console.log('📋 Test scenario from problem statement:');
  console.log(`   agentId: ${TEST_DATA.agentId}`);
  console.log(`   userAddress: ${TEST_DATA.userAddress}`);
  console.log(`   providerAddress: ${TEST_DATA.providerAddress} (unregistered)`);
  console.log(`   datasetHash: ${TEST_DATA.datasetHash}`);
  console.log(`   modelId: ${TEST_DATA.modelId}`);
  console.log('');

  try {
    console.log('🚀 Sending fine-tuning request...');
    
    const response = await fetch('http://localhost:3000/api/compute/fine-tune', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_DATA)
    });

    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS: Task created successfully');
      console.log(`📄 Task ID: ${data.taskId}`);
      console.log(`⛓️  Tx Hash: ${data.txHashAttested}`);
      console.log(`🔗 Chain Link: ${data.chainLink}`);
      console.log('🎉 ServiceNotExist error was handled gracefully!');
    } else {
      console.log('❌ FAILED: Task creation failed');
      console.log(`❌ Error: ${data.error}`);
      console.log(`❌ Details: ${data.details}`);
      
      // Check if we got the expected error handling
      if (response.status === 503 && data.error.includes('Provider unavailable')) {
        console.log('ℹ️  Expected behavior: Provider unavailable (503)');
      } else if (response.status === 422 && data.error.includes('preTrainedModelHash')) {
        console.log('ℹ️  Expected behavior: Model validation error (422)');
      } else {
        console.log('⚠️  Unexpected error response');
      }
    }
    
  } catch (error) {
    console.error('💥 Network error:', error.message);
  }
}

async function testProviderPreflight() {
  console.log('');
  console.log('🔍 Testing provider preflight checks...');
  
  const providerUrl = 'http://50.145.48.68:30080';
  
  try {
    // Test primary endpoint
    console.log(`🌐 Testing GET ${providerUrl}/v1/quote...`);
    const quoteResponse = await fetch(`${providerUrl}/v1/quote`, {
      method: 'GET',
      timeout: 5000
    });
    console.log(`📊 Quote endpoint: ${quoteResponse.status} ${quoteResponse.statusText}`);
  } catch (error) {
    console.log(`❌ Quote endpoint failed: ${error.message}`);
  }
  
  try {
    // Test fallback endpoints
    console.log(`🌐 Testing GET ${providerUrl}/health...`);
    const healthResponse = await fetch(`${providerUrl}/health`, {
      method: 'GET', 
      timeout: 5000
    });
    console.log(`📊 Health endpoint: ${healthResponse.status} ${healthResponse.statusText}`);
  } catch (error) {
    console.log(`❌ Health endpoint failed: ${error.message}`);
  }
}

// Run tests
async function main() {
  console.log('🧪 Fine-tuning ServiceNotExist Test Suite');
  console.log('==========================================');
  
  await testProviderPreflight();
  await testServiceNotExistHandling();
  
  console.log('');
  console.log('✅ Test suite completed');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testServiceNotExistHandling, testProviderPreflight };