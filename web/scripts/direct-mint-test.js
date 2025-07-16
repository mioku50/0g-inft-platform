// scripts/direct-mint-test.js
const { ethers } = require('ethers');

const INFT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "string", "name": "encryptedURI", "type": "string"},
      {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"}
    ],
    "name": "mint",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  }
];

async function directMintTest() {
  console.log('?? Direct Mint Test\n');
  
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  const wallet = new ethers.Wallet('60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65', provider);
  
  console.log('Wallet address:', wallet.address);
  
  // Проверяем баланс
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'A0GI\n');
  
  if (balance < ethers.parseEther('0.02')) {
    console.log('? Insufficient balance! Need at least 0.02 A0GI');
    console.log('Get testnet tokens from: https://faucet.0g.ai');
    return;
  }
  
  // Подключаемся к контракту
  const contractAddress = '0x53c92E4fba02D2eBB9D78E1d4913289defFea7f6';
  const contract = new ethers.Contract(contractAddress, INFT_ABI, wallet);
  
  // Подготавливаем данные для минта
  const mintData = {
    to: wallet.address,
    encryptedURI: '0g://storage/test-' + Date.now(),
    metadataHash: ethers.keccak256(ethers.toUtf8Bytes('test-metadata'))
  };
  
  console.log('Mint parameters:');
  console.log('  To:', mintData.to);
  console.log('  URI:', mintData.encryptedURI);
  console.log('  Hash:', mintData.metadataHash);
  console.log('  Value: 0.01 A0GI\n');
  
  try {
    // Оценка газа
    console.log('Estimating gas...');
    const estimatedGas = await contract.mint.estimateGas(
      mintData.to,
      mintData.encryptedURI,
      mintData.metadataHash,
      { value: ethers.parseEther('0.01') }
    );
    console.log('Estimated gas:', estimatedGas.toString());
    
    // Отправка транзакции
    console.log('\nSending transaction...');
    const tx = await contract.mint(
      mintData.to,
      mintData.encryptedURI,
      mintData.metadataHash,
      { 
        value: ethers.parseEther('0.01'),
        gasLimit: estimatedGas * 120n / 100n // +20% на всякий случай
      }
    );
    
    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('\n? Transaction confirmed!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    
    // Парсим события
    if (receipt.logs.length > 0) {
      console.log('\nEvents:');
      receipt.logs.forEach((log, i) => {
        console.log(`  Event ${i}:`, log);
      });
    }
    
  } catch (error) {
    console.error('\n? Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

directMintTest().catch(console.error);