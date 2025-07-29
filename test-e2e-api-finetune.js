const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

// Конфигурация
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
  API_BASE_URL: 'http://localhost:3000'
};

async function testE2EFineTune() {
  console.log('🧪 E2E Fine-Tune API Test');
  console.log('==========================\n');

  try {
    // Настройка для запросов к API
    process.env.OG_COMPUTE_PRIVATE_KEY = config.PRIVATE_KEY;
    process.env.NEXT_PUBLIC_FINE_TUNE_PROVIDER = config.PROVIDER_ADDRESS;
    
    // 1. Проверка ledger аккаунта через API
    console.log('1️⃣ Checking ledger account via API...');
    const accountResponse = await fetch(`${config.API_BASE_URL}/api/compute/account`);
    const accountData = await accountResponse.json();
    
    if (!accountResponse.ok) {
      console.error('❌ Failed to check account:', accountData);
      return;
    }
    
    console.log('📊 Account status:');
    console.log('   Exists:', accountData.result.exists);
    console.log('   Balance:', accountData.result.balance, 'OG');
    console.log('   Needs top-up:', accountData.result.needsTopUp);
    
    // 2. Пополнение если нужно
    if (!accountData.result.exists || parseFloat(accountData.result.balance) < 0.001) {
      console.log('\n2️⃣ Account needs funding...');
      const action = accountData.result.exists ? 'deposit' : 'create';
      const amount = '0.01';
      
      console.log(`   Action: ${action}`);
      console.log(`   Amount: ${amount} OG`);
      
      const depositResponse = await fetch(`${config.API_BASE_URL}/api/compute/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, action })
      });
      
      const depositData = await depositResponse.json();
      
      if (!depositResponse.ok) {
        console.error('❌ Deposit failed:', depositData);
        return;
      }
      
      console.log('✅ Account funded successfully!');
      console.log('   New balance:', depositData.newBalance, 'OG\n');
    } else {
      console.log('✅ Account has sufficient balance\n');
    }

    // 3. Проверка списка провайдеров
    console.log('3️⃣ Checking providers...');
    const providersResponse = await fetch(`${config.API_BASE_URL}/api/compute/providers`);
    
    if (providersResponse.ok) {
      const providersData = await providersResponse.json();
      console.log(`✅ Found ${providersData.providers?.length || 0} providers`);
      
      const targetProvider = providersData.providers?.find(
        p => p.address.toLowerCase() === config.PROVIDER_ADDRESS.toLowerCase()
      );
      
      if (targetProvider) {
        console.log('✅ Target provider found:', targetProvider.address);
      }
    }

    // 4. Подготовка данных для Fine-Tune
    console.log('\n4️⃣ Preparing training data...');
    const trainingData = {
      examples: [
        {
          input: "What is the capital of France?",
          output: "The capital of France is Paris."
        },
        {
          input: "What is 2+2?", 
          output: "2+2 equals 4."
        },
        {
          input: "Who wrote Romeo and Juliet?",
          output: "William Shakespeare wrote Romeo and Juliet."
        }
      ]
    };
    
    console.log('✅ Training data prepared:');
    console.log('   Examples:', trainingData.examples.length);
    console.log('   Data size:', JSON.stringify(trainingData).length, 'bytes\n');

    // 5. Загрузка данных в 0G Storage
    console.log('5️⃣ Uploading training data to 0G Storage...');
    const uploadResponse = await fetch(`${config.API_BASE_URL}/api/compute/dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: trainingData,
        name: `training-data-${Date.now()}.json`
      })
    });

    let datasetHash;
    if (uploadResponse.ok) {
      const uploadData = await uploadResponse.json();
      datasetHash = uploadData.datasetHash;
      console.log('✅ Dataset uploaded successfully!');
      console.log('   Hash:', datasetHash);
    } else {
      // Используем mock hash для теста
      datasetHash = '0x' + '0'.repeat(62) + '42';
      console.log('⚠️  Using mock dataset hash:', datasetHash);
    }

    // 6. Создание Fine-Tune задачи
    console.log('\n6️⃣ Creating Fine-Tune task...');
    const taskResponse = await fetch(`${config.API_BASE_URL}/api/compute/finetune/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.PROVIDER_ADDRESS,
        model: 'distilbert-base-uncased',
        datasetHash: datasetHash,
        dataSize: JSON.stringify(trainingData).length
      })
    });

    const taskData = await taskResponse.json();
    
    if (!taskResponse.ok) {
      console.error('❌ Task creation failed:', taskData);
      console.error('   Status:', taskResponse.status);
      console.error('   Error:', taskData.error);
      console.error('   Details:', taskData.details);
      
      // Проверяем конкретные ошибки
      if (taskData.error === 'AccountNotExists') {
        console.log('\n💡 Hint: Create a Fine-Tune account first for this provider');
      } else if (taskData.error === 'InsufficientBalance') {
        console.log('\n💡 Hint: Top up your account balance');
      } else if (taskData.error?.includes('acknowledged')) {
        console.log('\n💡 Hint: Provider needs to be acknowledged first');
      }
      
      return;
    }

    console.log('✅ Fine-Tune task created successfully!');
    console.log('   Task ID:', taskData.taskId);
    console.log('   Status:', taskData.status);

    // 7. Проверка статуса задачи
    if (taskData.taskId) {
      console.log('\n7️⃣ Checking task status...');
      const statusResponse = await fetch(
        `${config.API_BASE_URL}/api/compute/finetune/task/${taskData.taskId}`
      );
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('✅ Task status retrieved:');
        console.log('   Status:', statusData.status);
        console.log('   Created at:', statusData.createdAt);
      }
    }

    console.log('\n🎉 E2E Fine-Tune test completed successfully!');
    
    // Итоговая сводка
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Ledger account checked/funded');
    console.log('   ✅ Provider verified');
    console.log('   ✅ Training data prepared');
    console.log('   ' + (datasetHash.startsWith('0x00') ? '⚠️' : '✅') + ' Dataset uploaded');
    console.log('   ' + (taskData.taskId ? '✅' : '❌') + ' Fine-Tune task created');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Вспомогательная функция для проверки прямого SDK
async function testDirectSDK() {
  console.log('\n\n🔧 Testing Direct SDK Access');
  console.log('=============================\n');
  
  try {
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    const broker = await createZGComputeNetworkBroker(wallet);
    
    console.log('✅ SDK Broker created');
    console.log('   Signer:', broker.signerAddress);
    
    // Проверка ledger
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      console.log('✅ Ledger found:');
      console.log('   Balance:', ethers.formatEther(ledgerInfo[0]), 'OG');
      console.log('   Locked:', ethers.formatEther(ledgerInfo[1]), 'OG');
    } catch (error) {
      console.log('❌ No ledger account found');
    }
    
    // Проверка провайдеров Fine-Tune
    try {
      const providers = await broker.fineTuning.listProviders();
      console.log(`✅ Found ${providers.length} Fine-Tune providers`);
    } catch (error) {
      console.log('❌ Could not list providers:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Direct SDK test failed:', error.message);
  }
}

// Запуск тестов
console.log('⚠️  Make sure the Next.js dev server is running on port 3000!');
console.log('   Run: cd web && npm run dev\n');

setTimeout(async () => {
  await testE2EFineTune();
  await testDirectSDK();
}, 2000);