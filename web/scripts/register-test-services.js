const { ethers } = require('ethers');

// Конфигурация
const RPC_URL = 'https://evmrpc-testnet.0g.ai';
const CHAIN_ID = 16601;

// Контракты
const INFERENCE_CONTRACT = '0x5299bd255B76305ae08d7F95B270A485c6b95D54';

// ABI для регистрации сервисов (минимальный)
const SERVICE_ABI = [
  'function addService(string url, string model, uint256 inputPrice, uint256 outputPrice, string verifiability)',
  'function getService(address provider) view returns (tuple(address provider, string serviceType, string url, uint256 inputPrice, uint256 outputPrice, uint256 updatedAt, string model, string verifiability))',
  'function listService() view returns (tuple(address provider, string serviceType, string url, uint256 inputPrice, uint256 outputPrice, uint256 updatedAt, string model, string verifiability)[])'
];

// Официальные провайдеры
const OFFICIAL_PROVIDERS = [
  {
    address: '0xf07240Efa67755B5311bc75784a061eDB47165Dd',
    url: 'https://llama-service-testnet.0g.ai',
    model: 'llama-3.3-70b-instruct',
    inputPrice: ethers.parseEther('0.000001'),
    outputPrice: ethers.parseEther('0.000002'),
    verifiability: 'TeeML'
  },
  {
    address: '0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3',
    url: 'https://deepseek-service-testnet.0g.ai',
    model: 'deepseek-r1-70b',
    inputPrice: ethers.parseEther('0.000001'),
    outputPrice: ethers.parseEther('0.000002'),
    verifiability: 'TeeML'
  }
];

async function main() {
  try {
    console.log('🚀 Checking 0G Compute Services Registration');
    console.log('=============================================\n');

    // Создаем провайдера
    const provider = new ethers.JsonRpcProvider(RPC_URL, { name: '0g', chainId: CHAIN_ID });
    
    // Проверяем сеть
    const network = await provider.getNetwork();
    console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})\n`);

    // Создаем контракт для чтения
    const inferenceContract = new ethers.Contract(INFERENCE_CONTRACT, SERVICE_ABI, provider);

    // Проверяем текущие сервисы
    console.log('📋 Checking registered services...');
    try {
      const services = await inferenceContract.listService();
      console.log(`Found ${services.length} registered services:\n`);
      
      services.forEach((service, i) => {
        console.log(`Service ${i + 1}:`);
        console.log(`  Provider: ${service.provider}`);
        console.log(`  Model: ${service.model}`);
        console.log(`  URL: ${service.url}`);
        console.log(`  Verifiability: ${service.verifiability}`);
        console.log(`  Input Price: ${ethers.formatEther(service.inputPrice)} OG`);
        console.log(`  Output Price: ${ethers.formatEther(service.outputPrice)} OG\n`);
      });

      if (services.length === 0) {
        console.log('⚠️  No services found in contract!');
        console.log('This explains why the chat is not working.\n');
        
        console.log('📝 To register services, you need:');
        console.log('1. A wallet with provider privileges');
        console.log('2. Some OG tokens for gas fees');
        console.log('3. Run the provider registration process\n');
        
        console.log('🔗 Official providers that should be registered:');
        OFFICIAL_PROVIDERS.forEach(p => {
          console.log(`\n${p.model}:`);
          console.log(`  Address: ${p.address}`);
          console.log(`  URL: ${p.url}`);
          console.log(`  Verifiability: ${p.verifiability}`);
        });
      }
      
    } catch (error) {
      console.error('Error listing services:', error.message);
      console.log('\n⚠️  The contract might not have the listService function');
      console.log('or there might be a different issue with the contract.\n');
    }

    // Проверяем отдельных провайдеров
    console.log('\n📍 Checking specific providers...');
    for (const provider of OFFICIAL_PROVIDERS) {
      try {
        const service = await inferenceContract.getService(provider.address);
        if (service && service.provider !== ethers.ZeroAddress) {
          console.log(`✅ ${provider.model} is registered`);
        } else {
          console.log(`❌ ${provider.model} is NOT registered`);
        }
      } catch (error) {
        console.log(`❌ ${provider.model} check failed:`, error.message);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();