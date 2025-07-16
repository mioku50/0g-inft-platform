// scripts/check-contracts.js
const { ethers } = require('ethers');

async function checkContracts() {
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  
  const contracts = {
    INFT: '0x53c92E4fba02D2eBB9D78E1d4913289defFea7f6',
    Marketplace: '0xC68650eCbFd6A2a8e93E6D05Df6e4d404F01C8d5',
    Oracle: '0x8EBf5b9C599e77d44AE6A5A5f4E3dCAE935651cF'
  };
  
  console.log('Checking contracts on 0G Testnet...\n');
  
  for (const [name, address] of Object.entries(contracts)) {
    const code = await provider.getCode(address);
    const hasCode = code !== '0x';
    
    console.log(`${name} Contract:`);
    console.log(`  Address: ${address}`);
    console.log(`  Deployed: ${hasCode ? '? Yes' : '? No'}`);
    
    if (hasCode) {
      const balance = await provider.getBalance(address);
      console.log(`  Balance: ${ethers.formatEther(balance)} A0GI`);
    }
    console.log('');
  }
  
  // Проверяем ваш кошелек
  const walletAddress = new ethers.Wallet('60d6657135c7a050f5a326a93f39ded3a0295b6f70b28ce75f1e5d69f95bfe65').address;
  const walletBalance = await provider.getBalance(walletAddress);
  
  console.log('Your Wallet:');
  console.log(`  Address: ${walletAddress}`);
  console.log(`  Balance: ${ethers.formatEther(walletBalance)} A0GI`);
}

checkContracts().catch(console.error);