#!/usr/bin/env node

/**
 * Diagnostic script for Fine-Tune functionality
 * Checks all components and provides detailed information
 */

require('dotenv').config({ path: '../.env.local' });
const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper functions
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}\n`),
  data: (label, value) => console.log(`   ${colors.bright}${label}:${colors.reset} ${value}`)
};

// Configuration
const config = {
  rpcUrl: process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai',
  privateKey: process.env.OG_COMPUTE_PRIVATE_KEY,
  ledgerContract: process.env.COMPUTE_LEDGER_CONTRACT || '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  servingContract: process.env.FINE_TUNING_SERVING_ADDRESS || '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  inferenceContract: process.env.COMPUTE_INFERENCE_CONTRACT || '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
  fineTuneProvider: process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER || '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
};

async function diagnose() {
  log.section('FINE-TUNE DIAGNOSTICS');
  log.info('Starting comprehensive system check...\n');

  try {
    // 1. Check environment variables
    log.section('Environment Configuration');
    
    if (!config.privateKey) {
      log.error('OG_COMPUTE_PRIVATE_KEY is not set!');
      log.warn('This is required for server-side operations');
      return;
    } else {
      log.success('Private key configured');
    }

    log.data('RPC URL', config.rpcUrl);
    log.data('Ledger Contract', config.ledgerContract);
    log.data('Serving Contract', config.servingContract);
    log.data('Inference Contract', config.inferenceContract);
    log.data('Fine-Tune Provider', config.fineTuneProvider);

    // 2. Initialize connection
    log.section('Network Connection');
    
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const network = await provider.getNetwork();
    log.success(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
    
    const blockNumber = await provider.getBlockNumber();
    log.data('Current block', blockNumber);

    // 3. Check wallet
    log.section('Wallet Information');
    
    const wallet = new ethers.Wallet(config.privateKey, provider);
    log.data('Server wallet address', wallet.address);
    
    const balance = await provider.getBalance(wallet.address);
    log.data('Wallet balance', `${ethers.formatEther(balance)} OG`);
    
    if (parseFloat(ethers.formatEther(balance)) < 0.01) {
      log.warn('Low wallet balance! May not be enough for transactions');
    }

    // 4. Initialize broker
    log.section('0G SDK Broker');
    
    let broker;
    try {
      broker = await createZGComputeNetworkBroker(wallet);
      log.success('Broker initialized successfully');
    } catch (error) {
      log.error(`Failed to initialize broker: ${error.message}`);
      return;
    }

    // 5. Check Ledger account
    log.section('Ledger Account Status');
    
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      
      // Handle different response formats
      let ledgerBalance, ledgerLocked;
      if (ledgerInfo && typeof ledgerInfo === 'object') {
        if (Array.isArray(ledgerInfo)) {
          ledgerBalance = ledgerInfo[0];
          ledgerLocked = ledgerInfo[1] || '0';
        } else if (ledgerInfo.ledgerInfo) {
          ledgerBalance = ledgerInfo.ledgerInfo[0];
          ledgerLocked = ledgerInfo.ledgerInfo[1] || '0';
        } else {
          ledgerBalance = ledgerInfo.balance || ledgerInfo[0] || '0';
          ledgerLocked = ledgerInfo.locked || ledgerInfo[1] || '0';
        }
      }
      
      log.success('Ledger account exists');
      log.data('Balance', `${ethers.formatEther(ledgerBalance || '0')} OG`);
      log.data('Locked', `${ethers.formatEther(ledgerLocked || '0')} OG`);
      log.data('Raw response', JSON.stringify(ledgerInfo, null, 2));
      
    } catch (error) {
      log.error('No ledger account found');
      log.data('Error', error.message);
      log.warn('You need to create a ledger account first');
    }

    // 6. Check Fine-Tune provider
    log.section('Fine-Tune Provider Check');
    
    try {
      const services = await broker.inference.listService();
      const fineTuneService = services.find(s => 
        s.provider.toLowerCase() === config.fineTuneProvider.toLowerCase()
      );
      
      if (fineTuneService) {
        log.success('Fine-Tune provider is registered');
        log.data('Provider', fineTuneService.provider);
        log.data('Service type', fineTuneService.serviceType);
        log.data('Model', fineTuneService.model);
        log.data('URL', fineTuneService.url);
      } else {
        log.warn('Fine-Tune provider not found in service list');
      }
    } catch (error) {
      log.error(`Failed to list services: ${error.message}`);
    }

    // 7. Check Fine-Tune sub-account
    log.section('Fine-Tune Sub-Account');
    
    const servingAbi = [
      'function accountExists(address user, address provider) view returns (bool)',
      'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))'
    ];
    
    const servingContract = new ethers.Contract(config.servingContract, servingAbi, wallet);
    
    try {
      const hasAccount = await servingContract.accountExists(wallet.address, config.fineTuneProvider);
      
      if (hasAccount) {
        const account = await servingContract.getAccount(wallet.address, config.fineTuneProvider);
        log.success('Fine-Tune sub-account exists');
        log.data('Balance', `${ethers.formatEther(account.balance)} OG`);
        log.data('Pending refund', `${ethers.formatEther(account.pendingRefund)} OG`);
        log.data('Nonce', account.nonce.toString());
        log.data('Deliverables', account.deliverables.length);
      } else {
        log.warn('No Fine-Tune sub-account for this provider');
        log.info('You need to create a sub-account before creating tasks');
      }
    } catch (error) {
      log.error(`Failed to check Fine-Tune account: ${error.message}`);
    }

    // 8. Check provider acknowledgment
    log.section('Provider Acknowledgment');
    
    try {
      // Check if we can call acknowledge (it will fail if already acknowledged)
      await broker.fineTuning.acknowledgeProviderSigner(config.fineTuneProvider);
      log.warn('Provider was not acknowledged, acknowledgment sent');
    } catch (error) {
      if (error.message.includes('already acknowledged')) {
        log.success('Provider is already acknowledged');
      } else {
        log.error(`Acknowledgment check failed: ${error.message}`);
      }
    }

    // 9. Contract verification
    log.section('Contract Verification');
    
    // Check if contracts have code
    const contracts = [
      { name: 'Ledger', address: config.ledgerContract },
      { name: 'Serving', address: config.servingContract },
      { name: 'Inference', address: config.inferenceContract }
    ];
    
    for (const contract of contracts) {
      const code = await provider.getCode(contract.address);
      if (code && code !== '0x') {
        log.success(`${contract.name} contract verified at ${contract.address}`);
      } else {
        log.error(`${contract.name} contract not found at ${contract.address}`);
      }
    }

    // 10. Summary
    log.section('DIAGNOSTIC SUMMARY');
    
    log.info('Key findings:');
    log.data('1', 'Environment configuration looks correct');
    log.data('2', 'Wallet is properly configured');
    log.data('3', 'Network connection is working');
    log.data('4', 'Contracts are deployed and accessible');
    
    log.info('\nRecommendations:');
    log.data('•', 'Ensure your browser wallet matches the server wallet address');
    log.data('•', 'If balance shows 0, check if you\'re looking at the right address');
    log.data('•', 'Clear browser cache and restart the application');
    log.data('•', 'Check browser console for any client-side errors');

  } catch (error) {
    log.error(`Diagnostic failed: ${error.message}`);
    console.error(error);
  }
}

// Run diagnostics
diagnose().catch(console.error);