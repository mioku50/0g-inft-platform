async function checkContracts() {
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  
  const contracts = [
    { name: 'SDK Default Ledger', address: '0x0c0D02e4E849C711B2388A829366B5bf3f9c53e7' },
    { name: 'SDK Default Inference', address: '0x46e8a02d609CaEfC1747197da1F38272d5E46c77' },
    { name: 'SDK Default FineTuning', address: '0x35A5d96569867fE6534D823268337888229533dE' },
    { name: 'Found ServingAddress', address: '0xE7F0998C83a81f04871BEdfD89aB5f2DAcDBf435' }
  ];
  
  console.log('Checking contracts on Galileo v3 (Chain ID: 16601)\n');
  
  for (const contract of contracts) {
    try {
      const code = await provider.getCode(contract.address);
      const hasCode = code.length > 2;
      console.log(`${contract.name}:`);
      console.log(`  Address: ${contract.address}`);
      console.log(`  Has Code: ${hasCode ? 'YES ✓' : 'NO ✗'}`);
      console.log('');
    } catch (error) {
      console.log(`${contract.name}: ERROR - ${error.message}\n`);
    }
  }
  
  const network = await provider.getNetwork();
  console.log(`Chain ID: ${network.chainId}`);
}

checkContracts().catch(console.error);
