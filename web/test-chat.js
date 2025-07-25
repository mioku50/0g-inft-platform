#!/usr/bin/env node

const fetch = require('node-fetch');

async function testChatAPI() {
  const url = 'http://localhost:3000/api/compute/chat';
  const payload = {
    message: "hi",
    agentMetadata: {
      name: "TestAgent",
      description: "Agent desc"
    }
  };

  console.log('🚀 Testing chat API...');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 25000 // 25 секунд таймаут
    });

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log(`⏱️  Total request time: ${totalTime}ms`);
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));

    const responseText = await response.text();
    console.log('Raw response:', responseText);

    try {
      const data = JSON.parse(responseText);
      console.log('✅ Parsed JSON response:');
      console.log(JSON.stringify(data, null, 2));

      // Проверяем acceptance criteria
      if (data.success) {
        console.log('✅ Success: true');
      } else {
        console.log('❌ Success: false');
      }

      if (data.metadata?.timing?.totalTTFB) {
        console.log(`✅ TTFB: ${data.metadata.timing.totalTTFB}ms`);
      } else {
        console.log('❌ Missing TTFB timing');
      }

      if (typeof data.isRealAI === 'boolean') {
        console.log(`✅ isRealAI: ${data.isRealAI}`);
      } else {
        console.log('❌ Missing isRealAI field');
      }

    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError.message);
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testChatAPI();