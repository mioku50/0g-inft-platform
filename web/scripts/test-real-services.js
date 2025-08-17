const { ethers } = require('ethers');
const { createZGComputeNetworkBroker } = require('@0glabs/0g-serving-broker');
const OpenAI = require('openai');

// Конфигурация
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16601;

// Контракты
const LEDGER_CONTRACT = '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa';
const INFERENCE_CONTRACT = '0x5299bd255B76305ae08d7F95B270A485c6b95D54';
const FINE_TUNING_CONTRACT = '0xda478Ccf5d534346A16b1475E4c2DecE0268B176';

// Официальные провайдеры для Galileo testnet
const OFFICIAL_PROVIDERS = [
  {
    address: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    model: 'llama-3.3-70b-instruct'
  },
  {
    address: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
    model: 'deepseek-r1-70b'
  }
];

// Чтение приватного ключа из файла
const fs = require('fs');
const path = require('path');

function getPrivateKey() {
  try {
    const envPath = path.join(__dirname, '../.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/OG_COMPUTE_PRIVATE_KEY=([^\n]+)/);
    if (match) {
      return match[1].trim();
    }
  } catch (error) {
    console.error('Error reading .env.local:', error.message);
  }
  return null;
}

async function testRealServices() {
  console.log('🚀 Testing 0G Compute Real Services');
  console.log('=====================================\n');

  const privateKey = getPrivateKey();
  if (!privateKey) {
    console.error('❌ OG_COMPUTE_PRIVATE_KEY not found in .env.local');
    return;
  }

  try {
    // 1. Инициализация
    console.log('1️⃣ Initializing provider and wallet...');
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: '0g', chainId: CHAIN_ID });
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Wallet address: ${wallet.address}`);
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`Wallet balance: ${ethers.formatEther(balance)} OG\n`);

    // 2. Создание брокера
    console.log('2️⃣ Creating 0G Compute Network Broker...');
    const broker = await createZGComputeNetworkBroker(
      wallet,
      LEDGER_CONTRACT,
      INFERENCE_CONTRACT,
      FINE_TUNING_CONTRACT
    );
    console.log('Broker created successfully!\n');

    // 3. Проверка леджера
    console.log('3️⃣ Checking ledger account...');
    try {
      const ledgerInfo = await broker.ledger.getLedger();
      console.log(`Ledger balance: ${ethers.formatEther(ledgerInfo.balance)} OG`);
    } catch (error) {
      if (error.message.includes('not found')) {
        console.log('No ledger account found, creating one...');
        try {
          await broker.ledger.addLedger(ethers.parseEther('0.05'));
          console.log('Ledger account created with 0.05 OG');
        } catch (addError) {
          console.log('Add ledger error:', addError.message);
        }
      } else {
        console.log('Ledger check error:', error.message);
      }
    }
    console.log('');

    // 4. Тестирование провайдеров
    console.log('4️⃣ Testing official providers...\n');
    
    for (const providerInfo of OFFICIAL_PROVIDERS) {
      console.log(`\n📡 Testing ${providerInfo.model}`);
      console.log(`   Provider: ${providerInfo.address}`);
      
      try {
        // Получаем метаданные сервиса
        const meta = await broker.inference.getServiceMetadata(providerInfo.address);
        console.log(`   URL: ${meta.endpoint}`);
        console.log(`   Contract model: ${meta.model}`);

        // Попробуем сначала без acknowledge
        console.log('   Generating request headers...');
        const headers = await broker.inference.getRequestHeaders(providerInfo.address, 'Hello');
        
        // Подготовка запроса
        const requestBody = {
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant.' },
            { role: 'user', content: 'Hello! Please respond with a short greeting.' }
          ],
          model: meta.model,
          stream: false
        };

        // Отправка запроса
        console.log('   Sending test request...');
        const openai = new OpenAI({
          baseURL: meta.endpoint,
          apiKey: ''
        });

        const startTime = Date.now();
        const completion = await openai.chat.completions.create(requestBody, {
          headers: headers
        });
        const responseTime = Date.now() - startTime;

        console.log(`   ✅ Success! Response time: ${responseTime}ms`);
        console.log(`   Response: ${completion.choices[0].message.content}`);
        console.log(`   Chat ID: ${completion.id}`);
        
        // Попробуем верификацию
        try {
          const isValid = await broker.inference.processResponse(
            providerInfo.address,
            completion.choices[0].message.content,
            completion.id
          );
          console.log(`   Verification: ${isValid ? 'Valid' : 'Invalid'}`);
        } catch (verifyError) {
          console.log(`   Verification error: ${verifyError.message}`);
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        
        // Если ошибка авторизации, попробуем acknowledge
        if (error.message.includes('acknowledge') || error.message.includes('unauthorized')) {
          console.log('   Attempting to acknowledge provider...');
          try {
            await broker.inference.acknowledgeProviderSigner(providerInfo.address);
            console.log('   Provider acknowledged, retrying...');
            
            // Повторная попытка
            const headers = await broker.inference.getRequestHeaders(providerInfo.address, 'Hello');
            const meta = await broker.inference.getServiceMetadata(providerInfo.address);
            const requestBody = {
              messages: [{ role: 'user', content: 'Hello!' }],
              model: meta.model,
              stream: false
            };
            
            const openai = new OpenAI({
              baseURL: meta.endpoint,
              apiKey: ''
            });
            
            const completion = await openai.chat.completions.create(requestBody, {
              headers: headers
            });
            
            console.log(`   ✅ Success after acknowledge!`);
            console.log(`   Response: ${completion.choices[0].message.content}`);
            
          } catch (retryError) {
            console.log(`   ❌ Retry failed: ${retryError.message}`);
          }
        }
      }
    }

    console.log('\n\n📊 Test Summary:');
    console.log('=================');
    console.log('If providers are responding, the chat should work.');
    console.log('If not, check:');
    console.log('1. Network connectivity to 0G testnet');
    console.log('2. Provider services availability');
    console.log('3. Wallet balance for gas fees');
    console.log('4. Contract addresses match the network');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  }
}

// Запуск теста
testRealServices().catch(console.error);