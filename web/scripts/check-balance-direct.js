#!/usr/bin/env node

/**
 * Direct balance check script
 * Verifies the actual Ledger balance for the configured wallet
 */

require('dotenv').config({ path: '../.env.local' });
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

async function checkBalance() {
  console.log('🔍 Direct Balance Check\n');
  
  const privateKey = process.env.OG_COMPUTE_PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('❌ OG_COMPUTE_PRIVATE_KEY not set in environment');
    return;
  }
  
  // Extract address from private key
  const tempWallet = new ethers.Wallet(privateKey);
  console.log('📍 Checking balance for address:', tempWallet.address);
  console.log('🔑 Using private key:', privateKey.substring(0, 10) + '...\n');
  
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Check native balance
    const nativeBalance = await provider.getBalance(wallet.address);
    console.log('💰 Native wallet balance:', ethers.formatEther(nativeBalance), 'OG');
    
    // Initialize broker
    console.log('\n🔧 Initializing 0G broker...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ Broker initialized\n');
    
    // Check Ledger balance
    console.log('📊 Checking Ledger account...');
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      
      console.log('Raw response:', JSON.stringify(ledgerInfo, null, 2));
      
      // Handle different response formats
      let balance, locked;
      if (Array.isArray(ledgerInfo)) {
        balance = ledgerInfo[0];
        locked = ledgerInfo[1] || '0';
      } else if (ledgerInfo && ledgerInfo.ledgerInfo) {
        balance = ledgerInfo.ledgerInfo[0];
        locked = ledgerInfo.ledgerInfo[1] || '0';
      } else {
        balance = ledgerInfo.balance || '0';
        locked = ledgerInfo.locked || '0';
      }
      
      console.log('\n✅ Ledger account found!');
      console.log('💵 Ledger balance:', ethers.formatEther(balance || '0'), 'OG');
      console.log('🔒 Locked amount:', ethers.formatEther(locked || '0'), 'OG');
      console.log('💰 Available:', ethers.formatEther((BigInt(balance || '0') - BigInt(locked || '0')).toString()), 'OG');
      
    } catch (error) {
      console.error('❌ Error checking Ledger:', error.message);
      console.log('💡 You may need to create a Ledger account first');
    }
    
    // Check Fine-Tune accounts
    console.log('\n🎯 Checking Fine-Tune sub-accounts...');
    const providers = [
      '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
      '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3'
    ];
    
    const servingAddress = '0xda478Ccf5d534346A16b1475E4c2DecE0268B176';
    const servingAbi = [
      'function accountExists(address user, address provider) view returns (bool)',
      'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))'
    ];
    
    const servingContract = new ethers.Contract(servingAddress, servingAbi, wallet);
    
    for (const providerAddr of providers) {
      try {
        const hasAccount = await servingContract.accountExists(wallet.address, providerAddr);
        if (hasAccount) {
          const account = await servingContract.getAccount(wallet.address, providerAddr);
          console.log(`\n📦 Provider ${providerAddr.substring(0, 10)}...`);
          console.log('  Balance:', ethers.formatEther(account.balance), 'OG');
          console.log('  Pending:', ethers.formatEther(account.pendingRefund), 'OG');
        }
      } catch (error) {
        // Silently skip if no account
      }
    }
    
    console.log('\n✅ Balance check complete!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the check
checkBalance().catch(console.error);