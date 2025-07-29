const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');
const fs = require('fs');
const path = require('path');

const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function testFineTuneCreate() {
  console.log('🧪 Testing Fine Tune Task Creation');
  console.log('==================================\n');

  try {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    
    // 1. Create SDK broker
    console.log('1. Creating SDK broker...');
    const broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ SDK broker created');
    console.log('User address:', wallet.address, '\n');

    // 2. Check balance
    console.log('2. Checking ledger balance...');
    const ledgerInfo = await broker.ledger.getLedger();
    const balance = ethers.formatEther(ledgerInfo.ledgerInfo[0]);
    console.log('✅ Balance:', balance, 'OG\n');

    // 3. Check provider service
    console.log('3. Checking provider service...');
    const services = await broker.fineTuning.listService();
    const providerService = services.find(s => s.provider === config.PROVIDER_ADDRESS);
    
    if (!providerService) {
      console.log('❌ Provider not found in services');
      return;
    }
    
    console.log('✅ Provider service found:');
    console.log('   URL:', providerService.url);
    console.log('   Price per token:', providerService.pricePerToken, '\n');

    // 4. Acknowledge provider signer for fine-tuning
    console.log('4. Acknowledging provider signer for fine-tuning...');
    try {
      const ackResult = await broker.fineTuning.acknowledgeProviderSigner(config.PROVIDER_ADDRESS);
      console.log('✅ Provider acknowledged:', ackResult);
    } catch (error) {
      if (error.message.includes('already acknowledged')) {
        console.log('✅ Provider already acknowledged');
      } else {
        console.log('❌ Failed to acknowledge:', error.message);
        return;
      }
    }

    // 5. Create test configuration file
    console.log('\n5. Creating test configuration...');
    const testConfig = {
      "training": {
        "epochs": 3,
        "batch_size": 8,
        "learning_rate": 0.0001,
        "gradient_accumulation_steps": 1,
        "warmup_steps": 100,
        "max_steps": 1000,
        "save_steps": 500,
        "eval_steps": 100,
        "logging_steps": 10,
        "output_dir": "./output",
        "overwrite_output_dir": true,
        "do_train": true,
        "do_eval": true,
        "do_predict": false,
        "evaluation_strategy": "steps",
        "prediction_loss_only": false,
        "per_device_train_batch_size": 8,
        "per_device_eval_batch_size": 8,
        "fp16": false,
        "fp16_opt_level": "O1",
        "gradient_checkpointing": false,
        "dataloader_drop_last": false,
        "run_name": "test-fine-tune",
        "disable_tqdm": false,
        "remove_unused_columns": true,
        "label_names": null,
        "load_best_model_at_end": false,
        "metric_for_best_model": null,
        "greater_is_better": null,
        "ignore_data_skip": false,
        "sharded_ddp": [],
        "deepspeed": null,
        "label_smoothing_factor": 0,
        "debug": [],
        "optim": "adamw_hf",
        "adafactor": false,
        "group_by_length": false,
        "length_column_name": "length",
        "report_to": ["tensorboard"],
        "ddp_find_unused_parameters": null,
        "ddp_bucket_cap_mb": null,
        "dataloader_pin_memory": true,
        "skip_memory_metrics": true,
        "use_legacy_prediction_loop": false,
        "push_to_hub": false,
        "resume_from_checkpoint": null,
        "hub_model_id": null,
        "hub_strategy": "every_save",
        "hub_token": null,
        "gradient_accumulation_steps": 1,
        "include_inputs_for_metrics": false,
        "fp16_backend": "auto",
        "push_to_hub_model_id": null,
        "push_to_hub_organization": null,
        "push_to_hub_token": null,
        "mp_enabled": false,
        "train_data_path": "data/train.json",
        "val_data_path": "data/val.json"
      },
      "model": {
        "base_model": "distilbert-base-uncased",
        "model_type": "distilbert",
        "tokenizer_name": "distilbert-base-uncased",
        "num_labels": 2,
        "dropout_rate": 0.1,
        "attention_probs_dropout_prob": 0.1,
        "hidden_dropout_prob": 0.1,
        "max_seq_length": 512
      },
      "data": {
        "task_type": "text_classification",
        "data_format": "json",
        "text_column": "text",
        "label_column": "label",
        "max_length": 512,
        "pad_to_max_length": true,
        "truncation": true,
        "preprocessing_num_workers": 4,
        "overwrite_cache": false,
        "dataset_name": "custom",
        "dataset_config_name": null,
        "train_file": null,
        "validation_file": null,
        "test_file": null,
        "text_column_name": "text",
        "label_column_name": "label",
        "max_seq_length": 512,
        "overwrite_cache": false,
        "preprocessing_num_workers": null,
        "pad_to_max_length": true,
        "max_train_samples": null,
        "max_eval_samples": null,
        "max_predict_samples": null
      }
    };

    const configPath = path.join(process.cwd(), 'test-fine-tune-config.json');
    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
    console.log('✅ Config file created:', configPath);

    // 6. Create Fine Tune task
    console.log('\n6. Creating Fine Tune task...');
    const model = 'distilbert-base-uncased';
    const dataSize = 0; // Using 0 for test
    const datasetHash = '0x' + '0'.repeat(64); // Mock hash for test
    
    try {
      const taskResult = await broker.fineTuning.createTask(
        config.PROVIDER_ADDRESS,
        model,
        dataSize,
        datasetHash,
        configPath
      );
      
      console.log('✅ Task created successfully!');
      console.log('Result:', taskResult);
      
      // Extract task ID
      if (taskResult && taskResult.taskId) {
        console.log('Task ID:', taskResult.taskId);
      } else if (taskResult && taskResult.hash) {
        console.log('Transaction hash:', taskResult.hash);
      }
      
    } catch (error) {
      console.log('❌ Failed to create task:', error.message);
      
      // Check if it's a known error
      if (error.message.includes('Provider signer should be acknowledged')) {
        console.log('   Hint: Provider needs to be acknowledged first');
      } else if (error.message.includes('execution reverted')) {
        console.log('   Hint: Transaction was reverted by the contract');
        console.log('   This might be due to:');
        console.log('   - Invalid parameters');
        console.log('   - Insufficient balance');
        console.log('   - Provider not accepting tasks');
      }
    } finally {
      // Clean up config file
      try {
        fs.unlinkSync(configPath);
        console.log('\n✅ Cleaned up config file');
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testFineTuneCreate().catch(console.error);