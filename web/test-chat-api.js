#!/usr/bin/env node

const fetch = require('node-fetch');

async function testChatAPI() {
  console.log('🧪 Testing 0G Compute Chat API...\n');
  
  const testPayload = {
    message: "Hello! Can you help me understand how 0G Network works?",
    agentMetadata: {
      name: "TestAgent",
      description: "A helpful AI agent for testing 0G Compute infrastructure"
    }
  };

  const startTime = Date.now();
  
  try {
    console.log('📤 Sending request to localhost:3000/api/compute/chat');
    console.log('📝 Payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch('http://localhost:3000/api/compute/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
      timeout: 25000 // 25s timeout
    });

    const responseTime = Date.now() - startTime;
    console.log(`⏱️  Response time: ${responseTime}ms`);
    
    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error body:', errorText);
      return;
    }

    const result = await response.json();
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(result, null, 2));
    
    // Проверяем ожидаемые поля
    const checks = [
      { field: 'success', expected: true, actual: result.success },
      { field: 'response', expected: 'string', actual: typeof result.response },
      { field: 'isRealAI', expected: 'boolean', actual: typeof result.isRealAI },
      { field: 'metadata.timing.totalTTFB', expected: 'number', actual: typeof result.metadata?.timing?.totalTTFB }
    ];
    
    console.log('\n🔍 Validation checks:');
    let allPassed = true;
    
    checks.forEach(check => {
      const passed = check.actual === check.expected;
      allPassed = allPassed && passed;
      console.log(`${passed ? '✅' : '❌'} ${check.field}: ${check.actual} ${passed ? '==' : '!='} ${check.expected}`);
    });
    
    if (result.metadata?.timing) {
      console.log('\n⏱️  Timing breakdown:');
      Object.entries(result.metadata.timing).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}ms`);
      });
    }
    
    console.log(`\n${allPassed ? '🎉 All checks passed!' : '⚠️  Some checks failed'}`);
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the Next.js server is running with: pnpm dev');
    }
  }
}

testChatAPI();