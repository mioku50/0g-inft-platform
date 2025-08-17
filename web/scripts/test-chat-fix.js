const fetch = require('node-fetch')

async function testChat() {
  console.log('🧪 Testing Chat API Fix')
  console.log('======================\n')

  const API_URL = 'http://localhost:3000/api/compute/chat'
  
  const testMessages = [
    'hey',
    'Hello! How are you?',
    'Can you help me with coding?',
    'What is the capital of France?'
  ]

  for (const message of testMessages) {
    console.log(`\n📨 Sending message: "${message}"`)
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          agentMetadata: {
            name: 'TestAgent',
            description: 'A test AI agent for chat functionality'
          }
        })
      })

      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Success!')
        console.log(`   Model: ${data.model}`)
        console.log(`   Provider: ${data.provider}`)
        console.log(`   Is Real AI: ${data.isRealAI}`)
        console.log(`   Response: ${data.response?.substring(0, 100)}...`)
        console.log(`   TTFB: ${data.metadata?.timing?.totalTTFB}ms`)
      } else {
        console.log('❌ Failed:', data.error)
      }
    } catch (error) {
      console.log('❌ Error:', error.message)
    }
  }

  console.log('\n\n📊 Test Summary:')
  console.log('================')
  console.log('The chat API should now work with mock services.')
  console.log('Check the server logs for detailed information.')
}

// Run test
testChat().catch(console.error)