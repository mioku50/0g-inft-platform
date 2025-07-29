#!/usr/bin/env node

/**
 * Debug Ledger Call Script
 * Tests callStatic on ledger.addAccount with detailed error analysis
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

// Configuration
const RPC_URL = process.env.NEXT_PUBLIC_OG_RPC || 'https://evmrpc-testnet.0g.ai';
const LEDGER_ADDRESS = process.env.NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT;
const PROVIDER_ADDRESS = process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER;
const PRIVATE_KEY = process.env.OG_COMPUTE_PRIVATE_KEY;

// Contract ABIs
const LEDGER_ABI = [
  'function addAccount(address user, address provider, string memory additionalInfo) external payable',
  'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) external payable',
  'function requestRefundAll(address user, address provider) external'
];

// Expected selector for addAccount(address,address,string)
const EXPECTED_SELECTOR = '0xe50688f9';

function getMethodSelector(signature) {
  return ethers.id(signature).slice(0, 10);
}

async function testCallStatic(contract, methodName, params, value = 0n) {
  console.log(`🧪 Testing callStatic for ${methodName}...`);
  console.log(`   Parameters: ${JSON.stringify(params)}`);
  console.log(`   Value: ${ethers.formatEther(value)} ETH`);
  
  try {
    const result = await contract[methodName].staticCall(...params, { value });
    console.log(`✅ callStatic succeeded: ${result}`);
    return { success: true, result };
  } catch (error) {
    console.log(`❌ callStatic failed: ${error.message}`);
    
    // Analyze error details
    const errorData = error?.info?.error?.data || error?.data;
    if (errorData) {
      console.log(`   Error data: ${errorData}`);
      
      // Check if it's a generic revert
      if (errorData === '0x' || errorData.length <= 10) {
        console.log('   📊 Analysis: Generic revert without reason (likely require(false))');
        console.log('   💡 This suggests the function does not exist or validation failed');
      }
    }
    
    // Check for specific error patterns
    if (error.message.includes('revert')) {
      console.log('   📊 Analysis: Contract reverted execution');
    }
    if (error.message.includes('function does not exist')) {
      console.log('   📊 Analysis: Function not found in contract');
    }
    if (error.message.includes('invalid opcode')) {
      console.log('   📊 Analysis: Invalid opcode (function might not be payable)');
    }
    
    return { success: false, error: error.message, errorData };
  }
}

async function testEstimateGas(contract, methodName, params, value = 0n) {
  console.log(`⛽ Testing estimateGas for ${methodName}...`);
  
  try {
    const gasEstimate = await contract[methodName].estimateGas(...params, { value });
    console.log(`✅ estimateGas succeeded: ${gasEstimate.toString()} gas`);
    return { success: true, gasEstimate };
  } catch (error) {
    console.log(`❌ estimateGas failed: ${error.message}`);
    
    // If estimateGas fails with require(false), it often means the function doesn't exist
    if (error.message.includes('require(false)') || error.message.includes('revert')) {
      console.log('   📊 Analysis: estimateGas failure often indicates function does not exist or is not payable');
    }
    
    return { success: false, error: error.message };
  }
}

async function analyzeContract(provider, address) {
  console.log(`🔍 Analyzing contract at ${address}...`);
  
  try {
    const code = await provider.getCode(address);
    if (!code || code === '0x') {
      console.log('❌ Contract not deployed');
      return false;
    }
    
    console.log(`✅ Contract deployed (${code.length} bytes)`);
    
    // Check if the expected selector exists in bytecode
    const selector = EXPECTED_SELECTOR.slice(2); // Remove 0x
    if (code.includes(selector)) {
      console.log(`✅ Method selector ${EXPECTED_SELECTOR} found in bytecode`);
    } else {
      console.log(`❌ Method selector ${EXPECTED_SELECTOR} NOT found in bytecode`);
      console.log('   💡 This suggests addAccount(address,address,string) does not exist');
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Error analyzing contract: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🐛 Debug Ledger Call - Testing addAccount functionality\n');
  
  try {
    // Validate environment
    if (!LEDGER_ADDRESS) {
      throw new Error('NEXT_PUBLIC_COMPUTE_LEDGER_CONTRACT not set');
    }
    if (!PROVIDER_ADDRESS) {
      throw new Error('NEXT_PUBLIC_FINE_TUNE_PROVIDER not set');
    }
    if (!PRIVATE_KEY) {
      throw new Error('OG_COMPUTE_PRIVATE_KEY not set');
    }
    
    // Initialize provider and signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const network = await provider.getNetwork();
    
    console.log(`📡 Connected to network: Chain ID ${network.chainId}`);
    console.log(`👤 Using address: ${wallet.address}`);
    console.log(`🏗️  Ledger contract: ${LEDGER_ADDRESS}`);
    console.log(`🤖 Provider: ${PROVIDER_ADDRESS}\n`);
    
    // Analyze contract bytecode
    const contractExists = await analyzeContract(provider, LEDGER_ADDRESS);
    if (!contractExists) {
      process.exit(1);
    }
    console.log();
    
    // Create contract instance
    const ledgerContract = new ethers.Contract(LEDGER_ADDRESS, LEDGER_ABI, wallet);
    
    // Test parameters
    const testUser = wallet.address;
    const testProvider = PROVIDER_ADDRESS;
    const testInfo = 'INFT Platform User';
    const testValue = ethers.parseEther('0.01'); // 0.01 ETH
    
    console.log('🧪 Test Parameters:');
    console.log(`   User: ${testUser}`);
    console.log(`   Provider: ${testProvider}`);
    console.log(`   Additional Info: "${testInfo}"`);
    console.log(`   Value: ${ethers.formatEther(testValue)} ETH\n`);
    
    // Verify method selector
    const actualSelector = getMethodSelector('addAccount(address,address,string)');
    console.log(`🔧 Method Signature Analysis:`);
    console.log(`   Expected selector: ${EXPECTED_SELECTOR}`);
    console.log(`   Calculated selector: ${actualSelector}`);
    console.log(`   Match: ${actualSelector === EXPECTED_SELECTOR ? '✅' : '❌'}\n`);
    
    // Test 1: callStatic
    console.log('=' .repeat(60));
    console.log('TEST 1: callStatic');
    console.log('=' .repeat(60));
    
    const staticResult = await testCallStatic(
      ledgerContract, 
      'addAccount', 
      [testUser, testProvider, testInfo], 
      testValue
    );
    console.log();
    
    // Test 2: estimateGas
    console.log('=' .repeat(60));
    console.log('TEST 2: estimateGas');
    console.log('=' .repeat(60));
    
    const gasResult = await testEstimateGas(
      ledgerContract, 
      'addAccount', 
      [testUser, testProvider, testInfo], 
      testValue
    );
    console.log();
    
    // Test 3: Try without value (non-payable)
    console.log('=' .repeat(60));
    console.log('TEST 3: callStatic without value (testing if method is non-payable)');
    console.log('=' .repeat(60));
    
    const staticNoValueResult = await testCallStatic(
      ledgerContract, 
      'addAccount', 
      [testUser, testProvider, testInfo], 
      0n
    );
    console.log();
    
    // Analysis and recommendations
    console.log('📊 ANALYSIS & RECOMMENDATIONS');
    console.log('=' .repeat(60));
    
    if (!staticResult.success && !gasResult.success) {
      console.log('🚨 CRITICAL ISSUE DETECTED:');
      console.log('   Both callStatic and estimateGas failed');
      
      if (staticResult.errorData === '0x' || !staticResult.errorData) {
        console.log('   📋 Diagnosis: Function does not exist or is not payable');
        console.log('   💡 Solution: The Ledger contract is missing addAccount method');
        console.log('   🔧 Action: Contact 0G team for correct Ledger contract address');
      } else {
        console.log('   📋 Diagnosis: Function exists but validation failed');
        console.log('   💡 Solution: Check parameters or contract state');
      }
    } else if (staticResult.success) {
      console.log('✅ GOOD NEWS: addAccount method exists and works');
      console.log('   💡 The issue might be elsewhere in the transaction flow');
    } else if (!staticResult.success && staticNoValueResult.success) {
      console.log('⚠️  POTENTIAL ISSUE: Method exists but is not payable');
      console.log('   💡 The contract might have a different ABI than expected');
    }
    
    // Generate report
    console.log('\n📄 DETAILED REPORT FOR 0G TEAM:');
    console.log('=' .repeat(60));
    console.log(`Network: Chain ID ${network.chainId} (${network.chainId === 16601n ? 'Galileo Testnet' : 'Unknown'})`);
    console.log(`Ledger Contract: ${LEDGER_ADDRESS}`);
    console.log(`Contract Deployed: ${contractExists ? 'YES' : 'NO'}`);
    console.log(`Expected Method Selector: ${EXPECTED_SELECTOR}`);
    console.log(`Selector Found in Bytecode: ${actualSelector === EXPECTED_SELECTOR ? 'YES' : 'NO'}`);
    console.log(`callStatic Result: ${staticResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`estimateGas Result: ${gasResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (!staticResult.success) {
      console.log(`Error Details: ${staticResult.error}`);
      console.log(`Error Data: ${staticResult.errorData || 'None'}`);
    }
    
    console.log('\n🎯 CONCLUSION:');
    if (!staticResult.success && !gasResult.success) {
      console.log('The current Ledger contract does NOT support addAccount(address,address,string) payable.');
      console.log('Please provide the correct Ledger contract address for FineTuning operations.');
      process.exit(1);
    } else {
      console.log('The Ledger contract appears to support the required methods.');
      console.log('The issue may be in transaction parameters or network state.');
    }
    
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);