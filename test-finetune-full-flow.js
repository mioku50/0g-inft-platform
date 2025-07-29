const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

// Конфигурация
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65'
};

async function main() {
  console.log('🧪 Fine-Tune Full Flow Test');
  console.log('=============================\n');

  let broker;
  
  try {
    // 1. Подключение к сети и создание брокера
    console.log('1️⃣ Initializing provider and wallet...');
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    console.log('✅ Wallet address:', wallet.address);
    
    // Проверка баланса кошелька
    const balance = await provider.getBalance(wallet.address);
    console.log('✅ Wallet balance:', ethers.formatEther(balance), 'OG\n');

    // 2. Создание брокера
    console.log('2️⃣ Creating compute network broker...');
    broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ Broker created successfully\n');

    // 3. Проверка Ledger аккаунта
    console.log('3️⃣ Checking Ledger account...');
    let ledgerAccount;
    let hasLedgerAccount = false;
    
    try {
      ledgerAccount = await broker.ledger.getLedger();
      hasLedgerAccount = true;
      console.log('✅ Existing ledger account found:');
      console.log('   Balance:', ethers.formatEther(ledgerAccount[0]), 'OG');
      console.log('   Locked:', ethers.formatEther(ledgerAccount[1]), 'OG\n');
    } catch (error) {
      console.log('❌ No ledger account found, will create one\n');
    }

    // 4. Создание или пополнение Ledger аккаунта
    console.log('4️⃣ Managing Ledger account...');
    const depositAmount = 0.01; // OG
    
    if (hasLedgerAccount) {
      const currentBalance = parseFloat(ethers.formatEther(ledgerAccount[0]));
      
      // Проверка минимального баланса
      if (currentBalance < 0.001) {
        console.log('⚠️  Balance too low, depositing funds...');
        console.log('🔄 Using depositFund for existing account...');
        
        try {
          await broker.ledger.depositFund(depositAmount);
          console.log('✅ depositFund transaction completed successfully');
          
          // Проверка нового баланса
          const newLedgerInfo = await broker.ledger.getLedger();
          const newBalance = parseFloat(ethers.formatEther(newLedgerInfo[0]));
          console.log('✅ New balance:', newBalance, 'OG');
          console.log('✅ Balance increased by:', (newBalance - currentBalance).toFixed(6), 'OG\n');
        } catch (error) {
          console.error('❌ Deposit error:', error.message);
          throw error;
        }
      } else {
        console.log('✅ Sufficient balance available:', currentBalance, 'OG\n');
      }
    } else {
      console.log('🔄 Creating new ledger account...');
      try {
        await broker.ledger.addLedger(depositAmount);
        console.log('✅ Ledger account created successfully');
        
        // Проверка созданного аккаунта
        const newLedgerInfo = await broker.ledger.getLedger();
        console.log('✅ New account balance:', ethers.formatEther(newLedgerInfo[0]), 'OG\n');
      } catch (error) {
        console.error('❌ Account creation error:', error.message);
        throw error;
      }
    }

    // 5. Проверка провайдера Fine-Tune
    console.log('5️⃣ Checking Fine-Tune provider...');
    const providers = await broker.fineTuning.listProviders();
    const targetProvider = providers.find(p => 
      p.provider.toLowerCase() === config.PROVIDER_ADDRESS.toLowerCase()
    );
    
    if (!targetProvider) {
      throw new Error(`Provider ${config.PROVIDER_ADDRESS} not found`);
    }
    
    console.log('✅ Provider found:');
    console.log('   Address:', targetProvider.provider);
    console.log('   Available:', targetProvider.available);
    console.log('   Price per byte:', targetProvider.pricePerToken, 'A0GI\n');

    // 6. Acknowledge провайдера
    console.log('6️⃣ Acknowledging provider...');
    try {
      await broker.fineTuning.acknowledgeProviderSigner(config.PROVIDER_ADDRESS);
      console.log('✅ Provider acknowledged successfully\n');
    } catch (error) {
      if (error.message.includes('already acknowledged')) {
        console.log('✅ Provider already acknowledged\n');
      } else {
        throw error;
      }
    }

    // 7. Подготовка данных для Fine-Tune
    console.log('7️⃣ Preparing fine-tune data...');
    const trainingData = {
      examples: [
        {
          input: "What is the capital of France?",
          output: "The capital of France is Paris."
        },
        {
          input: "What is 2+2?",
          output: "2+2 equals 4."
        }
      ]
    };
    
    const dataString = JSON.stringify(trainingData);
    const dataSize = Buffer.from(dataString).length;
    console.log('✅ Training data prepared:');
    console.log('   Data size:', dataSize, 'bytes');
    console.log('   Examples count:', trainingData.examples.length, '\n');

    // 8. Симуляция загрузки данных (в реальности нужно загрузить в 0G Storage)
    console.log('8️⃣ Simulating data upload...');
    // В реальной реализации здесь должна быть загрузка в 0G Storage
    const mockDatasetHash = '0x' + '0'.repeat(62) + '42'; // Mock hash
    console.log('⚠️  Using mock dataset hash:', mockDatasetHash);
    console.log('   (In production, upload to 0G Storage first)\n');

    // 9. Создание Fine-Tune задачи
    console.log('9️⃣ Creating Fine-Tune task...');
    const model = 'distilbert-base-uncased';
    const trainingPath = 'train.json';
    const gasPrice = '0.000000001'; // 1 Gwei
    
    console.log('   Model:', model);
    console.log('   Provider:', config.PROVIDER_ADDRESS);
    console.log('   Dataset hash:', mockDatasetHash);
    console.log('   Data size:', dataSize);
    console.log('   Training path:', trainingPath);
    console.log('   Gas price:', gasPrice, 'OG\n');
    
    try {
      const taskId = await broker.fineTuning.createTask(
        config.PROVIDER_ADDRESS,
        model,
        dataSize,
        mockDatasetHash,
        trainingPath,
        gasPrice
      );
      
      console.log('✅ Fine-Tune task created successfully!');
      console.log('   Task ID:', taskId, '\n');
      
      // 10. Проверка статуса задачи
      console.log('🔟 Checking task status...');
      const taskInfo = await broker.fineTuning.getTask(taskId);
      console.log('✅ Task info:');
      console.log('   Status:', taskInfo.status);
      console.log('   Model:', taskInfo.preTrainedModelName);
      console.log('   Created at:', new Date(taskInfo.createdAt * 1000).toISOString());
      
    } catch (error) {
      console.error('❌ Task creation error:', error.message);
      
      // Детальный анализ ошибки
      if (error.message.includes('insufficient balance')) {
        console.log('\n💡 Suggestion: Top up your ledger account');
      } else if (error.message.includes('not acknowledged')) {
        console.log('\n💡 Suggestion: Acknowledge the provider first');
      } else if (error.message.includes('invalid dataset')) {
        console.log('\n💡 Suggestion: Upload dataset to 0G Storage first');
      }
      
      throw error;
    }

    // Финальная проверка баланса
    console.log('\n📊 Final balance check...');
    const finalLedger = await broker.ledger.getLedger();
    console.log('✅ Final ledger balance:', ethers.formatEther(finalLedger[0]), 'OG');
    console.log('✅ Locked amount:', ethers.formatEther(finalLedger[1]), 'OG');
    
    console.log('\n🎉 Fine-Tune full flow test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Запуск теста
main().catch(console.error);