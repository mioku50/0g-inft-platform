#!/usr/bin/env node

/**
 * Simple test for the 0G Chat service without Next.js build
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing 0G Chat Service Fix');
console.log('==============================\n');

// Test the chat API by starting the dev server temporarily
console.log('1️⃣ Starting development server...');

const serverProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let serverStarted = false;
let serverOutput = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  
  if (output.includes('Ready') || output.includes('localhost:3000') || output.includes('Local:')) {
    if (!serverStarted) {
      serverStarted = true;
      console.log('✅ Server started successfully');
      
      // Wait a bit for server to fully initialize
      setTimeout(testChatAPI, 3000);
    }
  }
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  if (!error.includes('warn') && !error.includes('Warning')) {
    console.log('Server stderr:', error);
  }
});

// Test the chat API
async function testChatAPI() {
  console.log('\n2️⃣ Testing chat API...');
  
  try {
    // Use dynamic import to handle ES modules
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('http://localhost:3000/api/compute/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'hey',
        agentMetadata: {
          name: 'OGPandaCook',
          description: 'A test AI agent for 0G network'
        }
      })
    });

    const result = await response.json();
    
    console.log('\n📊 Test Results:');
    console.log('================');
    console.log('Success:', result.success);
    console.log('Model:', result.model);
    console.log('Provider:', result.provider);
    console.log('Is Real AI:', result.isRealAI);
    console.log('Response:', result.response?.substring(0, 100) + '...');
    console.log('TTFB:', result.metadata?.timing?.totalTTFB + 'ms');
    
    if (result.metadata?.errors) {
      console.log('Errors:', result.metadata.errors);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    // Clean up
    console.log('\n3️⃣ Stopping server...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
}

// Handle timeout
setTimeout(() => {
  if (!serverStarted) {
    console.log('\n❌ Server failed to start within 30 seconds');
    console.log('Server output:', serverOutput);
    serverProcess.kill('SIGTERM');
    process.exit(1);
  }
}, 30000);

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted, cleaning up...');
  serverProcess.kill('SIGTERM');
  process.exit(0);
});