#!/usr/bin/env node

/**
 * Check Links Script
 * Verifies the connection between Serving.ledgerAddress() and environment configuration
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

// Configuration
const RPC_URL = process.env.NEXT_PUBLIC_OG_RPC || 'https://evmrpc-testnet.0g.ai';
const SERVING_ADDRESS = process.env.NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS;
const LEDGER_ADDRESS = process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT;
const PROVIDER_ADDRESS = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER;

// Contract ABIs
const SERVING_ABI = [
  'function ledgerAddress() view returns (address)',
  'function getService(address provider) view returns (tuple(address provider,string url,tuple(uint256,uint256,uint256,uint256,string) quota,uint256 pricePerToken,address providerSigner,bool occupied,string[] models))'
];

async function main() {
  console.log('🔗 Checking contract links and configuration...\n');
  
  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const network = await provider.getNetwork();
    console.log(`📡 Connected to network: Chain ID ${network.chainId}`);
    
    // Validate environment variables
    if (!SERVING_ADDRESS) {
      throw new Error('NEXT_PUBLIC_FINE_TUNING_SERVING_ADDRESS not set');
    }
    if (!LEDGER_ADDRESS) {
      throw new Error('NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT not set');
    }
    if (!PROVIDER_ADDRESS) {
      throw new Error('NEXT_PUBLIC_FINE_TUNE_PROVIDER not set');
    }
    
    console.log('🏗️  Contract Addresses:');
    console.log(`   FineTuningServing: ${SERVING_ADDRESS}`);
    console.log(`   Ledger (env):      ${LEDGER_ADDRESS}`);
    console.log(`   Provider:          ${PROVIDER_ADDRESS}\n`);
    
    // Check if contracts are deployed
    const servingCode = await provider.getCode(SERVING_ADDRESS);
    const ledgerCode = await provider.getCode(LEDGER_ADDRESS);
    
    if (!servingCode || servingCode === '0x') {
      throw new Error(`FineTuningServing contract not deployed at ${SERVING_ADDRESS}`);
    }
    console.log('✅ FineTuningServing contract is deployed');
    
    if (!ledgerCode || ledgerCode === '0x') {
      throw new Error(`Ledger contract not deployed at ${LEDGER_ADDRESS}`);
    }
    console.log('✅ Ledger contract is deployed\n');
    
    // Check Serving.ledgerAddress() vs NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT
    const servingContract = new ethers.Contract(SERVING_ADDRESS, SERVING_ABI, provider);
    
    let servingLedgerAddress;
    try {
      servingLedgerAddress = await servingContract.ledgerAddress();
      console.log('🔍 Ledger Address Verification:');
      console.log(`   From Serving.ledgerAddress(): ${servingLedgerAddress}`);
      console.log(`   From .env (COMPUTE_LEDGER):   ${LEDGER_ADDRESS}`);
      
      if (servingLedgerAddress.toLowerCase() === LEDGER_ADDRESS.toLowerCase()) {
        console.log('✅ Addresses match! Configuration is consistent.\n');
      } else {
        console.log('❌ ADDRESS MISMATCH! This is the root cause of the issue.\n');
        console.log('🚨 CRITICAL: The FineTuningServing contract expects a different Ledger!');
        console.log(`    Expected: ${servingLedgerAddress}`);
        console.log(`    Configured: ${LEDGER_ADDRESS}\n`);
        
        // Check if the expected ledger is deployed
        const expectedLedgerCode = await provider.getCode(servingLedgerAddress);
        if (!expectedLedgerCode || expectedLedgerCode === '0x') {
          console.log(`❌ Expected Ledger ${servingLedgerAddress} is NOT deployed`);
        } else {
          console.log(`✅ Expected Ledger ${servingLedgerAddress} IS deployed`);
          console.log('💡 Solution: Update NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT to use the correct address');
        }
      }
    } catch (error) {
      console.log(`❌ Failed to read ledgerAddress() from Serving contract: ${error.message}`);
    }
    
    // Check if provider service exists and is not occupied
    try {
      const service = await servingContract.getService(PROVIDER_ADDRESS);
      console.log('🔍 Provider Service Check:');
      console.log(`   Provider: ${PROVIDER_ADDRESS}`);
      console.log(`   URL: ${service.url || 'NOT SET'}`);
      console.log(`   Occupied: ${service.occupied}`);
      console.log(`   Models: ${service.models?.length || 0} available`);
      console.log(`   Provider Signer: ${service.providerSigner}`);
      
      if (!service.url || service.url.length === 0) {
        console.log('❌ Provider service does not exist or URL is empty');
      } else if (service.occupied) {
        console.log('⚠️  Provider is currently occupied');
      } else {
        console.log('✅ Provider service exists and is available');
      }
    } catch (error) {
      console.log(`❌ Failed to get provider service: ${error.message}`);
    }
    
    console.log('\n📋 Summary:');
    console.log('='.repeat(50));
    
    if (servingLedgerAddress && servingLedgerAddress.toLowerCase() !== LEDGER_ADDRESS.toLowerCase()) {
      console.log('🚨 CONFIGURATION ERROR DETECTED:');
      console.log(`   Update NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT to: ${servingLedgerAddress}`);
      console.log('   This should resolve the addAccount issues.');
      process.exit(1);
    } else {
      console.log('✅ Configuration appears correct');
      console.log('   If addAccount still fails, the issue may be with Ledger contract implementation');
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);