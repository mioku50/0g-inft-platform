const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

// Configuration based on successful CLI logs
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  SERVING_ADDRESS: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
  LEDGER_ADDRESS: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa',
  INFERENCE_ADDRESS: '0x5299bd255B76305ae08d7F95B270A485c6b95D54',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

// Test dataset hash from successful CLI run
const TEST_DATASET_HASH = '0x16d124afe2d6948e963c2539cc203331251c2ce4856104899ec036e81fd8c03d';
const TEST_MODEL = 'distilbert-base-uncased';
const TEST_MODEL_HASH = '0x7f2244b25cd2219dfd9d14c052982ecce409356e0f08e839b79796e270d110a7';

// Training parameters from successful CLI run
const TRAINING_PARAMS = {
  "num_train_epochs": 3,
  "per_device_train_batch_size": 16,
  "per_device_eval_batch_size": 16,
  "warmup_steps": 500,
  "weight_decay": 0.01,
  "logging_dir": "./logs",
  "logging_steps": 100,
  "evaluation_strategy": "no",
  "save_strategy": "epoch",
  "save_steps": 1,
  "save_total_limit": 1,
  "eval_steps": 50,
  "load_best_model_at_end": false,
  "metric_for_best_model": "accuracy",
  "greater_is_better": true,
  "report_to": ["none"]
};

async function testCompleteFinetuneFlow() {
  console.log('🧪 Testing Complete Fine-tune Flow');
  console.log('===================================');

  // Step 1: Setup
  console.log('\n1. Setting up connection...');
  const provider = new ethers.JsonRpcProvider(config.RPC_URL);
  const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
  const userAddress = wallet.address;
  
  console.log(`User address: ${userAddress}`);
  console.log(`Provider address: ${config.PROVIDER_ADDRESS}`);

  // Step 2: Check wallet balance
  console.log('\n2. Checking wallet balance...');
  const balance = await provider.getBalance(userAddress);
  console.log(`Wallet balance: ${ethers.formatEther(balance)} OG`);
  
  if (balance < ethers.parseEther('0.02')) {
    console.log('❌ Insufficient wallet balance for test');
    return;
  }

  // Step 3: Initialize broker using official SDK
  console.log('\n3. Initializing 0G Compute Network Broker...');
  let broker;
  try {
    broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ Broker initialized successfully');
    console.log(`Signer address: ${await wallet.getAddress()}`);
  } catch (error) {
    console.error('❌ Failed to initialize broker:', error.message);
    return;
  }

  // Step 4: Check/create account
  console.log('\n4. Checking/creating account...');
  try {
    // Try to get existing ledger first
    let account;
    try {
      account = await broker.ledger.getLedger();
      console.log('✅ Account already exists');
      console.log(`Current balance: ${ethers.formatEther(account.balance)} OG`);
    } catch (error) {
      // Account doesn't exist, create it
      console.log('Creating new account...');
      try {
        const createTx = await broker.ledger.addLedger(ethers.parseEther('0.01'));
        await createTx.wait();
        console.log('✅ Account created successfully');
      } catch (createError) {
        if (createError.message.includes('Ledger already exists')) {
          console.log('✅ Account already exists (confirmed during creation)');
        } else {
          throw createError;
        }
      }
      
      // Get account info after creation attempt
      account = await broker.ledger.getLedger();
    }
    
    // Step 5: Ensure sufficient balance
    console.log('\n5. Checking account balance...');
    if (account.balance && account.balance < ethers.parseEther('0.005')) {
      console.log('Adding more funds...');
      const depositTx = await broker.ledger.addLedger(ethers.parseEther('0.01'));
      await depositTx.wait();
      console.log('✅ Funds added successfully');
      
      // Update account info
      account = await broker.ledger.getLedger();
    } else if (!account.balance) {
      console.log('⚠️  Cannot check balance, proceeding with existing account');
    }
    
    console.log('Account info:', account);
    
    // Parse balance from ledgerInfo structure
    if (account.ledgerInfo && account.ledgerInfo.length >= 2) {
      const totalBalance = account.ledgerInfo[0];
      const lockedBalance = account.ledgerInfo[1];
      const availableBalance = totalBalance - lockedBalance;
      
      console.log(`Total balance: ${ethers.formatEther(totalBalance)} OG`);
      console.log(`Locked: ${ethers.formatEther(lockedBalance)} OG`);
      console.log(`Available: ${ethers.formatEther(availableBalance)} OG`);
      
      if (availableBalance < ethers.parseEther('0.005')) {
        console.log('⚠️  Low available balance, but proceeding with test');
      }
    } else {
      console.log('⚠️  Balance information not available');
    }
    
  } catch (error) {
    console.error('❌ Account setup failed:', error.message);
    return;
  }

  // Step 6: Verify provider
  console.log('\n6. Verifying provider...');
  try {
    // Check if provider signer is acknowledged
    const services = await broker.inference.listService();
    const providerService = services.find(s => s.provider.toLowerCase() === config.PROVIDER_ADDRESS.toLowerCase());
    
    if (!providerService) {
      console.error('❌ Provider service not found');
      return;
    }
    
    console.log('✅ Provider service found:', {
      provider: providerService.provider,
      url: providerService.url,
      pricePerToken: ethers.formatUnits(providerService.inputPrice, 'wei'),
      models: providerService.model
    });

    // Try to acknowledge provider signer for Fine Tuning (may fail due to network issues, but not critical)
    try {
      await broker.fineTuning.acknowledgeProviderSigner(config.PROVIDER_ADDRESS);
      console.log('✅ Fine Tuning provider signer acknowledged');
    } catch (ackError) {
      console.log('⚠️  Fine Tuning provider signer acknowledge failed:', ackError.message);
      
      // Also try inference acknowledge as fallback
      try {
        await broker.inference.acknowledgeProviderSigner(config.PROVIDER_ADDRESS);
        console.log('✅ Inference provider signer acknowledged as fallback');
      } catch (inferenceError) {
        console.log('⚠️  Both Fine Tuning and Inference acknowledge failed, proceeding anyway...');
      }
    }
    
  } catch (error) {
    console.error('❌ Provider verification failed:', error.message);
    return;
  }

  // Step 7: Calculate fee (based on CLI logic)
  console.log('\n7. Calculating fee...');
  const dataSize = 0; // From CLI logs - estimated data size
  const epochs = TRAINING_PARAMS.num_train_epochs;
  const pricePerToken = 1n; // From CLI logs - 1 neuron per token
  const estimatedFee = BigInt(dataSize) * pricePerToken * BigInt(epochs);
  
  console.log(`Data size: ${dataSize}`);
  console.log(`Training epochs: ${epochs}`);
  console.log(`Price per token: ${pricePerToken} neuron`);
  console.log(`Estimated fee: ${estimatedFee} neuron`);

  // Step 8: Create fine-tuning task
  console.log('\n8. Creating fine-tuning task...');
  
  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(__dirname, 'temp-config.json');
  
  try {
    // Create temporary config file for the SDK
    fs.writeFileSync(configPath, JSON.stringify(TRAINING_PARAMS, null, 2));
    console.log('Created temporary config file:', configPath);
    
    // Use the broker's fineTuning interface
    // Correct parameter order: providerAddress, preTrainedModelName, dataSize, datasetHash, trainingPath, gasPrice
    const taskResult = await broker.fineTuning.createTask(
      config.PROVIDER_ADDRESS,
      TEST_MODEL, // Use model name, not hash
      dataSize, // Data size as number
      TEST_DATASET_HASH,
      configPath, // Path to config file
      undefined // gasPrice (optional)
    );
    
    console.log('✅ Fine-tuning task created successfully!');
    console.log('Task result:', taskResult);
    
    // Check if it's a transaction or direct result
    if (taskResult && typeof taskResult.wait === 'function') {
      const receipt = await taskResult.wait();
      console.log(`Transaction hash: ${receipt.hash}`);
      
      // Extract task ID from events
      const taskCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = broker.fineTuning.interface.parseLog(log);
          return parsed.name === 'TaskCreated';
        } catch {
          return false;
        }
      });
      
      if (taskCreatedEvent) {
        const parsed = broker.fineTuning.interface.parseLog(taskCreatedEvent);
        console.log(`Task ID: ${parsed.args.taskId}`);
      }
    } else if (taskResult && taskResult.taskId) {
      console.log(`Task ID: ${taskResult.taskId}`);
    } else {
      console.log('Task created, but no task ID returned');
    }
    
    // Clean up temporary config file
    try {
      fs.unlinkSync(configPath);
      console.log('Cleaned up temporary config file');
    } catch (cleanupError) {
      console.log('Note: Could not clean up temporary config file');
    }
    
  } catch (error) {
    console.error('❌ Task creation failed:', error.message);
    console.error('Error details:', error);
    
    // Clean up temporary config file even on error
    try {
      fs.unlinkSync(configPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    return;
  }

  console.log('\n🎉 Complete fine-tune flow test completed successfully!');
}

// Run the test
testCompleteFinetuneFlow().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});