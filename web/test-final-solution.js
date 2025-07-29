const { ethers } = require('ethers');

async function testFinalSolution() {
  console.log('🧪 Testing Final Solution');
  console.log('==========================');

  try {
    // 1. Test API endpoint
    console.log('\n1. Testing API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/compute/account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deposit',
        amount: '0.01'
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API Success:', result);
      
      if (result.txHash && result.txHash !== 'sdk-success') {
        console.log('🔗 Transaction URL:', result.explorerUrl || `https://chainscan-galileo.0g.ai/tx/${result.txHash}`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Error details:', errorJson);
      } catch {
        // Error text is not JSON
      }
    }

    // 2. Test account status endpoint
    console.log('\n2. Testing account status...');
    
    const statusResponse = await fetch('http://localhost:3000/api/compute/account', {
      method: 'GET',
    });
    
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Account Status:', {
        exists: status.exists,
        balance: status.balance,
        needsTopUp: status.needsTopUp
      });
    } else {
      console.log('❌ Status check failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFinalSolution().catch(console.error);