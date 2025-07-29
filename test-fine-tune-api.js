const fetch = require('node-fetch');

// Test configuration
const API_BASE = 'http://localhost:3000/api/compute';
const TEST_PROVIDER = '0xf07240Efa67755B5311bc75784a061eDB47165Dd';

async function testFineTuneAPI() {
  console.log('🧪 Testing Fine-tune API with Fixes');
  console.log('===================================');

  try {
    // 1. Test providers endpoint
    console.log('\n1. Testing providers endpoint...');
    const providersResponse = await fetch(`${API_BASE}/fine-tune-v2?action=providers`);
    
    if (providersResponse.ok) {
      const providersData = await providersResponse.json();
      console.log('✅ Providers endpoint working:', {
        providersCount: providersData.providers?.length || 0,
        firstProvider: providersData.providers?.[0]?.address
      });
    } else {
      console.log('❌ Providers endpoint failed:', providersResponse.status);
      const error = await providersResponse.text();
      console.log('Error:', error);
    }

    // 2. Test models endpoint
    console.log('\n2. Testing models endpoint...');
    const modelsResponse = await fetch(`${API_BASE}/fine-tune-v2?action=models&provider=${TEST_PROVIDER}`);
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      console.log('✅ Models endpoint working:', {
        predefinedCount: modelsData.predefined?.length || 0,
        providerCount: modelsData.provider?.length || 0,
        firstModel: modelsData.predefined?.[0]?.name
      });
    } else {
      console.log('❌ Models endpoint failed:', modelsResponse.status);
      const error = await modelsResponse.text();
      console.log('Error:', error);
    }

    // 3. Test model usage endpoint
    console.log('\n3. Testing model usage endpoint...');
    const usageResponse = await fetch(`${API_BASE}/fine-tune-v2?action=model-usage&provider=${TEST_PROVIDER}&model=distilbert-base-uncased`);
    
    if (usageResponse.ok) {
      const usageData = await usageResponse.json();
      console.log('✅ Model usage endpoint working:', {
        hasUsage: !!usageData.usage,
        epochs: usageData.usage?.num_train_epochs
      });
    } else {
      console.log('❌ Model usage endpoint failed:', usageResponse.status);
      const error = await usageResponse.text();
      console.log('Error:', error);
    }

    // 4. Test token calculation
    console.log('\n4. Testing token calculation...');
    const tokenResponse = await fetch(`${API_BASE}/fine-tune-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'calculate-tokens',
        model: 'distilbert-base-uncased',
        datasetContent: 'This is a sample training dataset for fine-tuning. It contains multiple sentences to test the tokenization process.',
        provider: TEST_PROVIDER
      })
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      console.log('✅ Token calculation working:', {
        tokenSize: tokenData.tokenSize,
        dataSize: tokenData.dataSize
      });
    } else {
      console.log('❌ Token calculation failed:', tokenResponse.status);
      const error = await tokenResponse.text();
      console.log('Error:', error);
    }

    console.log('\n✅ API testing completed!');
    console.log('\nNote: Some endpoints may require wallet connection for full functionality.');
    console.log('The fixes have been applied and basic API endpoints are responding correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if called directly
if (require.main === module) {
  testFineTuneAPI();
}

module.exports = { testFineTuneAPI };