// Test script for the chat API
const { default: fetch } = require('node-fetch');

async function testChatAPI() {
  try {
    console.log('Testing 0G Compute Chat API...\n');
    
    const testMessage = {
      message: "Hey there! How are you?",
      agentMetadata: {
        name: "Test Agent",
        description: "A test AI agent for debugging purposes"
      }
    };
    
    console.log('Sending request to chat API...');
    const response = await fetch('http://localhost:3000/api/compute/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('\n=== Chat API Response ===');
    console.log('Success:', result.success);
    console.log('Is Real AI:', result.isRealAI);
    console.log('Model:', result.model);
    console.log('Provider:', result.provider);
    console.log('Response:', result.response);
    
    if (result.debug) {
      console.log('\n=== Debug Info ===');
      console.log(JSON.stringify(result.debug, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChatAPI();