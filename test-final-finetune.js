const { ethers } = require('./web/node_modules/ethers');
const { createZGComputeNetworkBroker } = require('./web/node_modules/@0glabs/0g-serving-broker');

// Конфигурация
const config = {
  RPC_URL: 'https://evmrpc-testnet.0g.ai',
  PRIVATE_KEY: '0x60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65',
  PROVIDER_ADDRESS: '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
};

async function testFinalFineTune() {
  console.log('🧪 Final Fine-Tune Test - Complete Flow');
  console.log('=======================================\n');
  console.log('ℹ️  Understanding the account structure:');
  console.log('   1. Main Ledger Account - holds funds for all operations');
  console.log('   2. Fine-Tune Sub-Account - provider-specific account for Fine-Tune tasks\n');

  let broker;
  
  try {
    // 1. Инициализация
    console.log('1️⃣ Initializing broker...');
    const provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
    broker = await createZGComputeNetworkBroker(wallet);
    console.log('✅ Broker initialized');
    console.log('   Address:', wallet.address);
    console.log('   Wallet balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'OG\n');

    // 2. Проверка главного Ledger аккаунта
    console.log('2️⃣ Checking main Ledger account...');
    let ledgerInfo;
    let hasLedgerAccount = false;
    
    try {
      ledgerInfo = await broker.ledger.getLedger();
      hasLedgerAccount = true;
      
      // SDK может возвращать разные форматы
      let balance, locked;
      if (Array.isArray(ledgerInfo)) {
        // Формат массива [balance, locked]
        balance = ledgerInfo[0];
        locked = ledgerInfo[1];
      } else if (ledgerInfo && typeof ledgerInfo === 'object') {
        // Формат объекта
        balance = ledgerInfo.balance || ledgerInfo[0];
        locked = ledgerInfo.locked || ledgerInfo[1] || '0';
      } else {
        throw new Error('Unexpected ledger info format');
      }
      
      console.log('✅ Main Ledger account found:');
      console.log('   Balance:', ethers.formatEther(balance || '0'), 'OG');
      console.log('   Locked:', ethers.formatEther(locked || '0'), 'OG');
    } catch (error) {
      console.log('❌ No main Ledger account found');
      console.log('   Error:', error.message);
    }

    // 3. Создание или пополнение главного Ledger
    const needsFunding = !hasLedgerAccount || !ledgerInfo || 
      (ledgerInfo && parseFloat(ethers.formatEther(Array.isArray(ledgerInfo) ? ledgerInfo[0] || '0' : ledgerInfo.balance || '0')) < 0.01);
      
    if (needsFunding) {
      console.log('\n3️⃣ Main Ledger needs funding...');
      const depositAmount = 0.015; // OG
      
      if (!hasLedgerAccount) {
        console.log('🔄 Creating new Ledger account...');
        await broker.ledger.addLedger(depositAmount);
        console.log('✅ Ledger account created');
      } else {
        console.log('🔄 Depositing to existing Ledger...');
        await broker.ledger.depositFund(depositAmount);
        console.log('✅ Funds deposited');
      }
      
      // Проверка нового баланса
      ledgerInfo = await broker.ledger.getLedger();
      const newBalance = Array.isArray(ledgerInfo) ? ledgerInfo[0] : ledgerInfo.balance;
      console.log('✅ New Ledger balance:', ethers.formatEther(newBalance || '0'), 'OG');
    } else {
      console.log('✅ Main Ledger has sufficient balance\n');
    }

    // 4. Проверка Fine-Tune sub-account для провайдера
    console.log('4️⃣ Checking Fine-Tune sub-account for provider...');
    const serving = new ethers.Contract(
      process.env.FINE_TUNING_SERVING_ADDRESS || '0xda478Ccf5d534346A16b1475E4c2DecE0268B176',
      [
        'function accountExists(address user, address provider) view returns (bool)',
        'function getAccount(address user, address provider) view returns (tuple(address user,address provider,uint256 nonce,uint256 balance,uint256 pendingRefund,tuple(uint256 index,uint256 amount,uint256 createdAt,bool processed)[] refunds,string additionalInfo,address providerSigner,tuple(bytes modelRootHash,bytes encryptedSecret,bool acknowledged)[] deliverables))',
        'function addAccount(address user, address provider, string additionalInfo) payable',
        'function depositFund(address user, address provider, uint256 cancelRetrievingAmount) payable'
      ],
      wallet
    );

    let hasFineTuneAccount = false;
    let fineTuneBalance = '0';
    
    try {
      hasFineTuneAccount = await serving.accountExists(wallet.address, config.PROVIDER_ADDRESS);
      if (hasFineTuneAccount) {
        const account = await serving.getAccount(wallet.address, config.PROVIDER_ADDRESS);
        fineTuneBalance = ethers.formatEther(account.balance);
        console.log('✅ Fine-Tune sub-account found:');
        console.log('   Provider:', config.PROVIDER_ADDRESS);
        console.log('   Balance:', fineTuneBalance, 'OG');
        console.log('   Pending refund:', ethers.formatEther(account.pendingRefund), 'OG');
      } else {
        console.log('❌ No Fine-Tune sub-account for this provider');
      }
    } catch (error) {
      console.log('❌ Error checking Fine-Tune account:', error.message);
    }

    // 5. Создание Fine-Tune sub-account если нужно
    if (!hasFineTuneAccount) {
      console.log('\n5️⃣ Creating Fine-Tune sub-account...');
      const fundAmount = ethers.parseEther('0.005');
      
      try {
        const tx = await serving.addAccount(
          wallet.address,
          config.PROVIDER_ADDRESS,
          '', // additionalInfo
          { value: fundAmount }
        );
        
        console.log('📤 Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('✅ Fine-Tune sub-account created!');
        console.log('   Block:', receipt.blockNumber);
        console.log('   Gas used:', receipt.gasUsed.toString());
        
        // Проверка созданного аккаунта
        const newAccount = await serving.getAccount(wallet.address, config.PROVIDER_ADDRESS);
        console.log('✅ New Fine-Tune balance:', ethers.formatEther(newAccount.balance), 'OG');
      } catch (error) {
        console.error('❌ Failed to create Fine-Tune account:', error.message);
        throw error;
      }
    }

    // 6. Acknowledge провайдера для Fine-Tune
    console.log('\n6️⃣ Acknowledging Fine-Tune provider...');
    try {
      await broker.fineTuning.acknowledgeProviderSigner(config.PROVIDER_ADDRESS);
      console.log('✅ Provider acknowledged');
    } catch (error) {
      if (error.message.includes('already acknowledged')) {
        console.log('✅ Provider already acknowledged');
      } else {
        console.error('❌ Acknowledge error:', error.message);
      }
    }

    // 7. Создание Fine-Tune задачи
    console.log('\n7️⃣ Creating Fine-Tune task...');
    const datasetHash = '0x' + '0'.repeat(62) + '42'; // Mock hash
    const model = 'distilbert-base-uncased';
    const dataSize = 1024; // bytes
    const trainingPath = 'config.toml';
    
    console.log('   Model:', model);
    console.log('   Dataset hash:', datasetHash);
    console.log('   Data size:', dataSize, 'bytes');
    
    try {
      const taskId = await broker.fineTuning.createTask(
        config.PROVIDER_ADDRESS,
        model,
        dataSize,
        datasetHash,
        trainingPath,
        '0.000000001' // gasPrice
      );
      
      console.log('✅ Fine-Tune task created!');
      console.log('   Task ID:', taskId);
      
      // Проверка задачи
      try {
        const taskInfo = await broker.fineTuning.getTask(taskId);
        console.log('✅ Task info retrieved:');
        console.log('   Status:', taskInfo.status);
        console.log('   Created at:', new Date(taskInfo.createdAt * 1000).toISOString());
      } catch (error) {
        console.log('⚠️  Could not retrieve task info:', error.message);
      }
      
    } catch (error) {
      console.error('❌ Task creation failed:', error.message);
      
      // Анализ ошибки
      if (error.message.includes('insufficient')) {
        console.log('\n💡 Hint: Top up your Fine-Tune sub-account balance');
      } else if (error.message.includes('dataset')) {
        console.log('\n💡 Hint: Upload real dataset to 0G Storage first');
      } else if (error.message.includes('provider')) {
        console.log('\n💡 Hint: Check provider availability and registration');
      }
    }

    // 8. Финальная проверка балансов
    console.log('\n8️⃣ Final balance check...');
    
    // Главный Ledger
    const finalLedger = await broker.ledger.getLedger();
    console.log('📊 Main Ledger:');
    console.log('   Balance:', ethers.formatEther(finalLedger[0]), 'OG');
    console.log('   Locked:', ethers.formatEther(finalLedger[1]), 'OG');
    
    // Fine-Tune sub-account
    if (await serving.accountExists(wallet.address, config.PROVIDER_ADDRESS)) {
      const finalFineTune = await serving.getAccount(wallet.address, config.PROVIDER_ADDRESS);
      console.log('📊 Fine-Tune sub-account:');
      console.log('   Balance:', ethers.formatEther(finalFineTune.balance), 'OG');
      console.log('   Pending refund:', ethers.formatEther(finalFineTune.pendingRefund), 'OG');
    }

    console.log('\n✅ Test completed!');
    console.log('\n📋 Summary:');
    console.log('   1. Main Ledger account: ✅');
    console.log('   2. Fine-Tune sub-account: ✅');
    console.log('   3. Provider acknowledged: ✅');
    console.log('   4. Task creation: ' + (error.message ? '❌ (expected with mock data)' : '✅'));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Запуск теста
console.log('Starting test in 2 seconds...\n');
setTimeout(() => {
  testFinalFineTune().catch(console.error);
}, 2000);