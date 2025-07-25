#!/usr/bin/env node

const fetch = require('node-fetch');

async function testChatAPI() {
  console.log('🚀 Testing 0G Compute Chat API...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/compute/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello! Can you tell me about yourself?',
        agentMetadata: {
          name: 'TestAgent',
          description: 'A helpful AI assistant for testing 0G Compute infrastructure'
        }
      })
    });

    const totalTime = Date.now() - startTime;
    console.log(`⏱️  Total request time: ${totalTime}ms`);

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error body:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Response received:\n');
    console.log('📊 Success:', data.success);
    console.log('🤖 Is Real AI:', data.isRealAI);
    console.log('💬 Response:', data.response?.substring(0, 100) + '...');
    
    if (data.metadata?.timing) {
      console.log('\n⏱️  Timing Metrics:');
      Object.entries(data.metadata.timing).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}ms`);
      });
    }
    
    if (data.metadata?.providers) {
      console.log('\n🔗 Providers Info:');
      console.log(`   Found: ${data.metadata.providers.found}`);
      console.log(`   Attempted: ${data.metadata.providers.attempted}`);
      console.log(`   Successful: ${data.metadata.providers.successful}`);
    }

    // Проверяем acceptance criteria
    console.log('\n✅ Acceptance Criteria Check:');
    console.log(`   TTFB < 4s: ${data.metadata?.timing?.totalTTFB < 4000 ? '✅' : '❌'} (${data.metadata?.timing?.totalTTFB}ms)`);
    console.log(`   Has timing data: ${data.metadata?.timing ? '✅' : '❌'}`);
    console.log(`   Success response: ${data.success ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   pnpm dev');
    }
  }
}

// Запускаем тест
testChatAPI();