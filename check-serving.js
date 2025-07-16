async function checkServing() {
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  
  // Адрес из upgrade_verifier.ts
  const servingAddress = '0xE7F0998C83a81f04871BEdfD89aB5f2DAcDBf435';
  
  try {
    const code = await provider.getCode(servingAddress);
    console.log(`InferenceServing at ${servingAddress}:`);
    console.log(`Has code: ${code.length > 2 ? 'YES ✓' : 'NO ✗'}`);
    
    if (code.length > 2) {
      // Попробуем вызвать initialized()
      const abi = ['function initialized() view returns (bool)'];
      const contract = new ethers.Contract(servingAddress, abi, provider);
      
      try {
        const isInit = await contract.initialized();
        console.log(`Initialized: ${isInit}`);
      } catch (e) {
        console.log('Could not call initialized()');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkServing().catch(console.error);
