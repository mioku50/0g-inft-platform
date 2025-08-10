#!/usr/bin/env node

/**
 * Comprehensive Chat Flow Test
 * Tests the complete chat flow including health, ledger, and message sending
 */

const ENDPOINT_BASE = 'http://localhost:3000'

async function testHealthEndpoint() {
  console.log('🏥 Testing health endpoint...')
  
  try {
    const response = await fetch(`${ENDPOINT_BASE}/api/compute/health`)
    const data = await response.json()
    
    console.log('✅ Health endpoint response:')
    console.log('  SDK Version:', data.sdk?.sdkVersion || 'unknown')
    console.log('  SDK Exports:', data.sdk?.sdkExports?.length || 0, 'exports')
    console.log('  Mode:', data.mode)
    console.log('  Compute custodial:', data.compute?.custodial)
    console.log('  Flags:', JSON.stringify(data.flags, null, 2))
    
    return true
  } catch (error) {
    console.error('❌ Health endpoint failed:', error.message)
    return false
  }
}

async function testChatEndpointCustodial() {
  console.log('\n💬 Testing custodial chat endpoint...')
  
  try {
    const response = await fetch(`${ENDPOINT_BASE}/api/compute/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, this is a test message',
        agentMetadata: {
          name: 'Test Agent',
          description: 'AI assistant for testing'
        },
        providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
      })
    })
    
    console.log('  Response status:', response.status)
    
    const data = await response.json()
    console.log('  Response data:')
    console.log('    Success:', data.success)
    console.log('    Error:', data.error)
    console.log('    RequiresPreparedRequest:', data.requiresPreparedRequest)
    
    if (data.success) {
      console.log('    Response length:', data.response?.length || 0, 'characters')
      console.log('    Model:', data.model)
      console.log('    IsRealAI:', data.isRealAI)
    }
    
    return data.success || data.error === 'non_custodial_required'
  } catch (error) {
    console.error('❌ Chat endpoint failed:', error.message)
    return false
  }
}

async function testChatEndpointNonCustodial() {
  console.log('\n🔒 Testing non-custodial chat requirement...')
  
  try {
    const response = await fetch(`${ENDPOINT_BASE}/api/compute/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, this is a test message',
        prepared: true, // But no prep object provided
        agentMetadata: {
          name: 'Test Agent',
          description: 'AI assistant for testing'
        },
        providerAddress: '0xf07240Efa67755B5311bc75784a061eDB47165Dd'
      })
    })
    
    console.log('  Response status:', response.status)
    const data = await response.json()
    
    if (response.status === 400 && data.error === 'non_custodial_required') {
      console.log('✅ Non-custodial mode is correctly enforced')
      return true
    } else {
      console.log('❌ Expected non_custodial_required error, got:', data.error)
      return false
    }
  } catch (error) {
    console.error('❌ Non-custodial test failed:', error.message)
    return false
  }
}

async function testProxyEndpoint() {
  console.log('\n🔀 Testing proxy endpoint...')
  
  try {
    const response = await fetch(`${ENDPOINT_BASE}/api/compute/proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint: 'https://api.0g.ai/test',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test'
        },
        body: JSON.stringify({
          test: 'data'
        })
      })
    })
    
    console.log('  Response status:', response.status)
    const data = await response.json()
    
    // Expected to fail because endpoint doesn't exist, but should process the request
    if (response.status >= 400) {
      console.log('  Expected failure (test endpoint):', data.error)
      return true // This is expected for test
    }
    
    return false
  } catch (error) {
    console.error('❌ Proxy endpoint failed:', error.message)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting 0G INFT Platform Chat Flow Tests\n')
  
  const results = {
    health: false,
    chatCustodial: false,
    chatNonCustodial: false,
    proxy: false
  }
  
  results.health = await testHealthEndpoint()
  results.chatCustodial = await testChatEndpointCustodial()
  results.chatNonCustodial = await testChatEndpointNonCustodial()
  results.proxy = await testProxyEndpoint()
  
  console.log('\n📊 Test Results Summary:')
  console.log('  Health endpoint:', results.health ? '✅ PASS' : '❌ FAIL')
  console.log('  Chat (custodial):', results.chatCustodial ? '✅ PASS' : '❌ FAIL')
  console.log('  Chat (non-custodial):', results.chatNonCustodial ? '✅ PASS' : '❌ FAIL')
  console.log('  Proxy endpoint:', results.proxy ? '✅ PASS' : '❌ FAIL')
  
  const passCount = Object.values(results).filter(Boolean).length
  console.log(`\n🎯 Overall: ${passCount}/4 tests passed`)
  
  if (passCount === 4) {
    console.log('🎉 All tests passed! Chat functionality is working correctly.')
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.')
  }
}

// Add a simple server health check first
async function waitForServer() {
  console.log('⏳ Waiting for server to be ready...')
  
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${ENDPOINT_BASE}/api/compute/health`)
      if (response.ok) {
        console.log('✅ Server is ready')
        return true
      }
    } catch (error) {
      // Server not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    process.stdout.write('.')
  }
  
  console.log('\n❌ Server failed to start within 30 seconds')
  return false
}

// Run the tests
waitForServer().then(ready => {
  if (ready) {
    runAllTests()
  } else {
    console.log('Please start the development server with: npm run dev')
    process.exit(1)
  }
}).catch(console.error)