async function checkOfficialContracts() {
  const { ethers } = await import('ethers');
  console.log('=== Checking Official 0G Compute Contract Addresses ===\n');
  
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  
  // Адреса из официального репозитория
  const contracts = [
    { name: 'LedgerManager', address: '0x1a85Dd32da10c170F4f138d082DDc496ab3E5BAa' },
    { name: 'InferenceServing', address: '0x5299bd255B76305ae08d7F95B270A485c6b95D54' },
    { name: 'FineTuningServing', address: '0xda478Ccf5d534346A16b1475E4c2DecE0268B176' }
  ];
  
  try {
    const network = await provider.getNetwork();
    console.log(`Network: Galileo v3 (Chain ID: ${network.chainId})\n`);
    
    let allDeployed = true;
    
    for (const contract of contracts) {
      const code = await provider.getCode(contract.address);
      const hasCode = code.length > 2;
      
      console.log(`${contract.name}:`);
      console.log(`  Address: ${contract.address}`);
      console.log(`  Status: ${hasCode ? '✅ DEPLOYED' : '❌ NOT FOUND'}`);
      
      if (hasCode) {
        console.log(`  Code size: ${code.length} bytes`);
      } else {
        allDeployed = false;
      }
      console.log('');
    }
    
    if (allDeployed) {
      console.log('🎉 All contracts are deployed! Ready to use 0G Compute!');
    } else {
      console.log('⚠️ Some contracts are not deployed on this network');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkOfficialContracts();
