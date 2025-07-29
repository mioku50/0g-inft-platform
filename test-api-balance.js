const axios = require('./web/node_modules/axios').default;

async function testAPIBalance() {
  console.log('🧪 Testing API Balance Response');
  console.log('================================\n');

  const API_BASE_URL = 'http://localhost:3000/api/compute/account';

  try {
    console.log('1. Fetching account info...');
    const response = await axios.get(API_BASE_URL);
    
    console.log('\n2. Full API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n3. Parsed values:');
    const data = response.data;
    
    // Check different possible paths
    console.log('data.result?.balance:', data.result?.balance);
    console.log('data.balance:', data.balance);
    console.log('data.result?.exists:', data.result?.exists);
    console.log('data.result?.locked:', data.result?.locked);
    console.log('data.result?.needsTopUp:', data.result?.needsTopUp);
    
    console.log('\n4. Frontend would see:');
    const accountData = {
      balance: data.result?.balance || data.balance || '0',
      exists: data.result?.exists || data.exists || false,
      needsTopUp: parseFloat(data.result?.balance || data.balance || '0') < 0.001
    };
    console.log('accountData:', accountData);
    
    console.log('\n5. Balance display:');
    console.log(`Balance shown in UI: ${accountData.balance} OG`);
    
  } catch (error) {
    if (error.response) {
      console.error('❌ API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('❌ No response from server. Is the Next.js dev server running?');
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testAPIBalance().catch(console.error);